import type { SDKAssistantMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { OmniContentBlock, OmniMessage, OmniUsage } from "@omni-agent-sdk/core";

// ---------------------------------------------------------------------------
// Structural helpers
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

// ---------------------------------------------------------------------------
// Structural content block types
// We narrow `BetaMessage.content` elements structurally since BetaMessage
// and BetaContentBlock come from @anthropic-ai/sdk (not installed directly).
// ---------------------------------------------------------------------------

interface TextBlock {
	type: "text";
	text: string;
}

interface ToolUseBlock {
	type: "tool_use";
	id: string;
	name: string;
	input: unknown;
}

interface ToolResultBlock {
	type: "tool_result";
	tool_use_id: string;
	content: unknown;
	is_error?: boolean;
}

interface ThinkingBlock {
	type: "thinking";
	thinking: string;
}

type KnownContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock;

function narrowContentBlock(raw: unknown): KnownContentBlock | undefined {
	if (!isObject(raw) || typeof raw.type !== "string") {
		return undefined;
	}
	const type = raw.type as string;
	if (type === "text" && typeof raw.text === "string") {
		return { type: "text", text: raw.text };
	}
	if (type === "tool_use" && typeof raw.id === "string" && typeof raw.name === "string") {
		return {
			type: "tool_use",
			id: raw.id,
			name: raw.name,
			input: raw.input,
		};
	}
	if (type === "tool_result" && typeof raw.tool_use_id === "string") {
		return {
			type: "tool_result",
			tool_use_id: raw.tool_use_id,
			content: raw.content,
			is_error: typeof raw.is_error === "boolean" ? raw.is_error : undefined,
		};
	}
	if (type === "thinking" && typeof raw.thinking === "string") {
		return { type: "thinking", thinking: raw.thinking };
	}
	return undefined;
}

/**
 * Maps a single narrowed content block to an OmniContentBlock.
 */
function mapContentBlock(block: KnownContentBlock): OmniContentBlock | undefined {
	switch (block.type) {
		case "text":
			return { type: "text", text: block.text };

		case "tool_use":
			return {
				type: "tool_use",
				toolName: block.name,
				toolId: block.id,
				input: block.input,
			};

		case "tool_result":
			return {
				type: "tool_result",
				toolId: block.tool_use_id,
				output: block.content,
				isError: block.is_error === true,
			};

		case "thinking":
			return { type: "reasoning", text: block.thinking };
	}
}

/**
 * Maps an SDKAssistantMessage to an OmniMessage.
 * SDKAssistantMessage.message is a BetaMessage whose content blocks we narrow
 * structurally to avoid depending on @anthropic-ai/sdk types directly.
 */
export function mapAssistantMessage(sdkMessage: SDKAssistantMessage): OmniMessage {
	const content: OmniContentBlock[] = [];

	// BetaMessage.content is BetaContentBlock[], but BetaContentBlock is from
	// @anthropic-ai/sdk which is not installed directly. We access via structural
	// typing after an intermediate cast through a plain object shape.
	const msgObj: Record<string, unknown> = sdkMessage.message as unknown as Record<string, unknown>;
	const rawContent: unknown[] = Array.isArray(msgObj.content) ? (msgObj.content as unknown[]) : [];

	for (const raw of rawContent) {
		const block = narrowContentBlock(raw);
		if (block !== undefined) {
			const mapped = mapContentBlock(block);
			if (mapped !== undefined) {
				content.push(mapped);
			}
		}
	}

	// SDKAssistantMessage.message.id comes from BetaMessage.id
	const messageId = typeof msgObj.id === "string" ? msgObj.id : sdkMessage.uuid;

	return {
		id: messageId,
		role: "assistant",
		content,
		createdAt: new Date(),
		raw: sdkMessage,
	};
}

// ---------------------------------------------------------------------------
// SDKResultMessage shape helpers
// ---------------------------------------------------------------------------

/**
 * Both SDKResultSuccess and SDKResultError share these required fields.
 */
interface SDKResultCommonShape {
	total_cost_usd: number;
	duration_ms: number;
	num_turns: number;
	usage: unknown;
}

function isSDKResultCommonShape(value: unknown): value is SDKResultCommonShape {
	return (
		isObject(value) &&
		typeof value.total_cost_usd === "number" &&
		typeof value.duration_ms === "number" &&
		typeof value.num_turns === "number"
	);
}

interface SDKUsageShape {
	input_tokens: number;
	output_tokens: number;
}

function isSDKUsageShape(value: unknown): value is SDKUsageShape {
	return (
		isObject(value) &&
		typeof value.input_tokens === "number" &&
		typeof value.output_tokens === "number"
	);
}

/**
 * Maps an SDKResultMessage to OmniUsage.
 * Both SDKResultSuccess and SDKResultError share total_cost_usd, duration_ms,
 * num_turns, and usage fields, accessed via runtime type guards.
 */
export function mapResultUsage(result: SDKResultMessage): OmniUsage {
	const usage: OmniUsage = {};

	if (isSDKResultCommonShape(result)) {
		usage.totalCostUsd = result.total_cost_usd;
		usage.durationMs = result.duration_ms;
		usage.numTurns = result.num_turns;

		if (isSDKUsageShape(result.usage)) {
			const input = result.usage.input_tokens;
			const output = result.usage.output_tokens;
			usage.tokens = { input, output, total: input + output };
		}
	}

	return usage;
}
