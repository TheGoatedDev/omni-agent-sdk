import type { OmniContentBlock, OmniMessage, OmniUsage, PromptResult } from "@omni-agent-sdk/core";
import type { ThreadItem, Turn } from "@openai/codex-sdk";

const PROVIDER = "codex";

/**
 * Derive a tool ID for a ThreadItem, consistent with the event mapper.
 */
function resolveToolId(item: ThreadItem): string {
	if (item.toolCallId !== undefined && item.toolCallId.length > 0) {
		return item.toolCallId;
	}
	return `${PROVIDER}:${item.id}`;
}

/**
 * Derive a tool name for a ThreadItem, consistent with the event mapper.
 */
function resolveToolName(item: ThreadItem): string {
	if (item.toolName !== undefined && item.toolName.length > 0) {
		return item.toolName;
	}
	return item.type;
}

/**
 * Convert a single ThreadItem into an OmniMessage.
 *
 * agentMessage items become assistant messages with text content.
 * commandExecution / mcpToolCall / fileChange items become assistant messages
 * carrying tool_use and associated content blocks.
 */
function mapThreadItemToMessage(item: ThreadItem): OmniMessage {
	const content: OmniContentBlock[] = [];

	if (item.type === "agentMessage") {
		if (item.content !== undefined && item.content.length > 0) {
			content.push({ type: "text", text: item.content });
		}
		return {
			id: item.id,
			role: "assistant",
			content,
			createdAt: new Date(),
			raw: item,
		};
	}

	if (item.type === "commandExecution" || item.type === "mcpToolCall") {
		const toolId = resolveToolId(item);
		const toolName = resolveToolName(item);

		content.push({
			type: "tool_use",
			toolName,
			toolId,
			input: item.input,
		});

		if (item.output !== undefined || item.isError !== undefined) {
			content.push({
				type: "tool_result",
				toolId,
				output: item.output,
				isError: item.isError === true,
			});
		}

		return {
			id: item.id,
			role: "assistant",
			content,
			createdAt: new Date(),
			raw: item,
		};
	}

	if (item.type === "fileChange") {
		const toolId = resolveToolId(item);

		content.push({
			type: "tool_use",
			toolName: resolveToolName(item),
			toolId,
			input: item.input,
		});

		content.push({
			type: "file_change",
			path: item.path ?? "",
			operation: item.operation ?? "edit",
			diff: item.diff,
		});

		return {
			id: item.id,
			role: "assistant",
			content,
			createdAt: new Date(),
			raw: item,
		};
	}

	// Unknown item types: surface as a text message with the raw type label.
	content.push({ type: "text", text: `[${item.type}]` });
	return {
		id: item.id,
		role: "assistant",
		content,
		createdAt: new Date(),
		raw: item,
	};
}

/**
 * Map a completed Codex Turn to an OmniPromptResult.
 *
 * @param turn      - The Turn returned by thread.run()
 * @param sessionId - The thread ID used as the session identifier
 */
export function mapTurnToPromptResult(turn: Turn, sessionId: string): PromptResult {
	const messages: OmniMessage[] = turn.items.map(mapThreadItemToMessage);

	const isError = turn.status === "failed" || turn.status === "interrupted";

	const usage: OmniUsage = {};

	return {
		sessionId,
		messages,
		text: turn.finalResponse,
		isError,
		usage,
		raw: turn,
	};
}
