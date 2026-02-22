import type { OmniContentBlock, OmniEvent, OmniMessage, OmniUsage } from "@omni-agent-sdk/core";
import type { CodexEvent, ThreadItem } from "@openai/codex-sdk";

const PROVIDER = "codex";

/** Returns true for both camelCase and snake_case variants of "agentMessage". */
function isAgentMessageItem(item: ThreadItem): boolean {
	return item.type === "agentMessage" || item.type === "agent_message";
}

/** Returns true for both camelCase and snake_case variants of tool-use items. */
function isToolItem(item: ThreadItem): boolean {
	return (
		item.type === "commandExecution" ||
		item.type === "command_execution" ||
		item.type === "mcpToolCall" ||
		item.type === "mcp_tool_call"
	);
}

/** Returns true for both camelCase and snake_case variants of "fileChange". */
function isFileChangeItem(item: ThreadItem): boolean {
	return item.type === "fileChange" || item.type === "file_change";
}

/**
 * Extract the text of an agent message, preferring the `text` field used by
 * the live Codex SDK over the `content` field from earlier SDK drafts.
 */
function agentMessageText(item: ThreadItem): string {
	return item.text ?? item.content ?? "";
}

/**
 * Build an OmniMessage from a completed agentMessage ThreadItem.
 */
function buildAgentMessage(item: ThreadItem): OmniMessage {
	const content: OmniContentBlock[] = [];

	const text = agentMessageText(item);
	if (text.length > 0) {
		content.push({ type: "text", text });
	}

	return {
		id: item.id,
		role: "assistant",
		content,
		createdAt: new Date(),
		raw: item,
	};
}

/**
 * Derive a stable tool name for items which may not carry an explicit toolName.
 */
function resolveToolName(item: ThreadItem): string {
	if (item.toolName !== undefined && item.toolName.length > 0) {
		return item.toolName;
	}
	if (item.type === "commandExecution" || item.type === "command_execution") {
		return "commandExecution";
	}
	if (item.type === "mcpToolCall" || item.type === "mcp_tool_call") {
		return "mcpToolCall";
	}
	if (item.type === "fileChange" || item.type === "file_change") {
		return "fileChange";
	}
	return item.type;
}

/**
 * Derive a stable tool ID for items that may not carry an explicit toolCallId.
 */
function resolveToolId(item: ThreadItem): string {
	if (item.toolCallId !== undefined && item.toolCallId.length > 0) {
		return item.toolCallId;
	}
	return `${PROVIDER}:${item.id}`;
}

function mapItemStarted(item: ThreadItem): OmniEvent[] {
	if (isAgentMessageItem(item)) {
		return [{ type: "message_start", role: "assistant" }];
	}
	if (isToolItem(item) || isFileChangeItem(item)) {
		return [
			{
				type: "tool_start",
				toolName: resolveToolName(item),
				toolId: resolveToolId(item),
				input: item.input,
			},
		];
	}
	return [];
}

function mapItemCompleted(item: ThreadItem): OmniEvent[] {
	if (isAgentMessageItem(item)) {
		const message = buildAgentMessage(item);
		const events: OmniEvent[] = [];
		// The live Codex SDK (≥0.104) does not emit item/agentMessage/delta events;
		// text arrives only in item.completed. Synthesize a text_delta so that
		// streaming consumers always receive at least one text event when there is
		// agent output.
		const text = agentMessageText(item);
		if (text.length > 0) {
			events.push({ type: "text_delta", text });
		}
		events.push({ type: "message_end", message });
		return events;
	}

	if (isToolItem(item)) {
		return [
			{
				type: "tool_end",
				toolId: resolveToolId(item),
				output: item.output,
				isError: item.isError === true,
			},
		];
	}

	if (isFileChangeItem(item)) {
		const fileOutput: OmniContentBlock = {
			type: "file_change",
			path: item.path ?? "",
			operation: item.operation ?? "edit",
			diff: item.diff,
		};
		return [
			{
				type: "tool_end",
				toolId: resolveToolId(item),
				output: fileOutput,
				isError: item.isError === true,
			},
		];
	}

	return [];
}

function mapTurnCompleted(
	usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined,
): OmniEvent[] {
	let omniUsage: OmniUsage | undefined;
	if (usage !== undefined) {
		const inputTokens = usage.inputTokens ?? 0;
		const outputTokens = usage.outputTokens ?? 0;
		const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;
		omniUsage = {
			tokens: {
				input: inputTokens,
				output: outputTokens,
				total: totalTokens,
			},
		};
	}
	return [{ type: "turn_end", usage: omniUsage }];
}

/**
 * Map a Codex CodexEvent to zero or more OmniEvents.
 *
 * Returns an array because some Codex events fan out to multiple OmniEvents.
 */
export function mapCodexEvent(event: CodexEvent): OmniEvent[] {
	const type = event.type;

	if (type === "item.started") {
		// Safe: only CodexEventItemStarted has type "item.started"
		const item = (event as { type: "item.started"; item: ThreadItem }).item;
		return mapItemStarted(item);
	}

	if (type === "item.completed") {
		const item = (event as { type: "item.completed"; item: ThreadItem }).item;
		return mapItemCompleted(item);
	}

	if (type === "item/agentMessage/delta") {
		const delta = (event as { type: "item/agentMessage/delta"; delta: string }).delta;
		return [{ type: "text_delta", text: delta }];
	}

	if (type === "turn.completed") {
		const usage = (
			event as {
				type: "turn.completed";
				usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
			}
		).usage;
		return mapTurnCompleted(usage);
	}

	return [];
}
