import type { OmniContentBlock, OmniMessage, OmniUsage, PromptResult } from "@omni-agent-sdk/core";
import type { Message, Part, PromptResponse } from "@opencode-ai/sdk";

// ---------------------------------------------------------------------------
// Part → OmniContentBlock
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * Maps a single OpenCode Part to zero or one OmniContentBlock.
 * FileParts are skipped (they appear as tool_use/tool_result in our model).
 */
function mapPart(part: Part): OmniContentBlock | undefined {
	if (!isObject(part)) return undefined;

	switch (part.type) {
		case "text":
			if (typeof part.text === "string") {
				return { type: "text", text: part.text };
			}
			return undefined;

		case "tool":
			if (typeof part.toolName === "string" && typeof part.toolID === "string") {
				if (part.state === "completed" || part.state === "error") {
					// Return both tool_use (input) and tool_result (output) as separate blocks
					// We only return tool_use here; the caller gets the pair via mapPartToBlocks.
					return {
						type: "tool_use",
						toolName: part.toolName,
						toolId: part.toolID,
						input: part.input,
					};
				}
				// For pending/running states, emit a tool_use with available info
				return {
					type: "tool_use",
					toolName: part.toolName,
					toolId: part.toolID,
					input: part.input,
				};
			}
			return undefined;

		case "reasoning":
			if (typeof part.text === "string") {
				return { type: "reasoning", text: part.text };
			}
			return undefined;

		// "file" parts are skipped
		default:
			return undefined;
	}
}

/**
 * Maps a Part to zero, one, or two OmniContentBlocks.
 * Tool parts with completed/error state produce both a tool_use and a tool_result block.
 */
function mapPartToBlocks(part: Part): OmniContentBlock[] {
	if (!isObject(part)) return [];

	if (
		part.type === "tool" &&
		typeof part.toolName === "string" &&
		typeof part.toolID === "string"
	) {
		const toolUse: OmniContentBlock = {
			type: "tool_use",
			toolName: part.toolName,
			toolId: part.toolID,
			input: part.input,
		};

		if (part.state === "completed") {
			const toolResult: OmniContentBlock = {
				type: "tool_result",
				toolId: part.toolID,
				output: part.output,
				isError: false,
			};
			return [toolUse, toolResult];
		}

		if (part.state === "error") {
			const toolResult: OmniContentBlock = {
				type: "tool_result",
				toolId: part.toolID,
				output: part.error,
				isError: true,
			};
			return [toolUse, toolResult];
		}

		// pending/running — only the tool_use block
		return [toolUse];
	}

	const block = mapPart(part);
	return block !== undefined ? [block] : [];
}

// ---------------------------------------------------------------------------
// Message → OmniMessage
// ---------------------------------------------------------------------------

/**
 * Maps an OpenCode Message to an OmniMessage.
 */
export function mapMessage(message: Message): OmniMessage {
	const content: OmniContentBlock[] = [];

	if (Array.isArray(message.parts)) {
		for (const part of message.parts) {
			const blocks = mapPartToBlocks(part as Part);
			for (const block of blocks) {
				content.push(block);
			}
		}
	}

	return {
		id: message.id,
		role: message.role === "user" ? "user" : "assistant",
		content,
		createdAt: message.createdAt !== undefined ? new Date(message.createdAt) : new Date(),
		raw: message,
	};
}

// ---------------------------------------------------------------------------
// Message[] → text
// ---------------------------------------------------------------------------

export function collectText(messages: OmniMessage[]): string {
	const parts: string[] = [];
	for (const msg of messages) {
		for (const block of msg.content) {
			if (block.type === "text") {
				parts.push(block.text);
			}
		}
	}
	return parts.join("");
}

// ---------------------------------------------------------------------------
// Message usage → OmniUsage
// ---------------------------------------------------------------------------

function mapMessageUsage(message: Message): OmniUsage {
	const usage = message.usage;
	if (!isObject(usage)) {
		return {};
	}

	const omniUsage: OmniUsage = {};

	const inputTokens = typeof usage.inputTokens === "number" ? usage.inputTokens : 0;
	const outputTokens = typeof usage.outputTokens === "number" ? usage.outputTokens : 0;
	const totalTokens =
		typeof usage.totalTokens === "number" ? usage.totalTokens : inputTokens + outputTokens;

	if (inputTokens > 0 || outputTokens > 0 || totalTokens > 0) {
		omniUsage.tokens = { input: inputTokens, output: outputTokens, total: totalTokens };
	}

	if (typeof usage.costUsd === "number") {
		omniUsage.totalCostUsd = usage.costUsd;
	}

	return omniUsage;
}

// ---------------------------------------------------------------------------
// PromptResponse → PromptResult
// ---------------------------------------------------------------------------

/**
 * Builds a PromptResult from a synchronous PromptResponse (non-streaming prompt).
 */
export function buildPromptResult(response: PromptResponse, sessionId: string): PromptResult {
	const messages = Array.isArray(response.messages) ? response.messages : [];
	const omniMessages = messages.map(mapMessage);

	// Aggregate usage across all messages (last assistant message typically has it)
	let usage: OmniUsage = {};
	for (const msg of messages) {
		if (msg.role === "assistant" && isObject(msg.usage)) {
			usage = mapMessageUsage(msg);
		}
	}

	return {
		sessionId,
		messages: omniMessages,
		text: collectText(omniMessages),
		isError: false,
		usage,
		raw: response,
	};
}
