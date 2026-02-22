/**
 * Minimal type declarations for @openai/codex-sdk.
 *
 * The package is a peer dependency and may not be installed during type-checking,
 * so we declare the subset of types required by this provider implementation.
 * These declarations must remain in sync with the upstream SDK.
 */
declare module "@openai/codex-sdk" {
	export interface CodexOptions {
		env?: Record<string, string>;
		config?: Record<string, unknown>;
	}

	export interface ThreadItem {
		id: string;
		/**
		 * Item type. The SDK uses snake_case values (e.g. "agent_message",
		 * "command_execution") in practice; camelCase variants are kept for
		 * backwards-compatibility with earlier SDK drafts.
		 */
		type:
			| "agentMessage"
			| "agent_message"
			| "commandExecution"
			| "command_execution"
			| "fileChange"
			| "file_change"
			| "mcpToolCall"
			| "mcp_tool_call"
			| "reasoning"
			| (string & {});
		/** Text content of an agent message (used by the live SDK). */
		text?: string;
		/** Content field used by earlier SDK drafts — prefer `text` for agent messages. */
		content?: string;
		path?: string;
		operation?: "create" | "edit" | "delete";
		diff?: string;
		toolName?: string;
		toolCallId?: string;
		input?: unknown;
		output?: unknown;
		isError?: boolean;
		raw?: unknown;
	}

	export interface Turn {
		id: string;
		items: ThreadItem[];
		finalResponse: string;
		status: "completed" | "interrupted" | "failed";
		error?: { message: string };
	}

	export interface CodexEventItemStarted {
		type: "item.started";
		item: ThreadItem;
	}

	export interface CodexEventItemCompleted {
		type: "item.completed";
		item: ThreadItem;
	}

	export interface CodexEventAgentMessageDelta {
		type: "item/agentMessage/delta";
		itemId: string;
		delta: string;
	}

	export interface CodexEventTurnCompleted {
		type: "turn.completed";
		usage?: {
			inputTokens?: number;
			outputTokens?: number;
			totalTokens?: number;
		};
	}

	/** Catch-all for future or unknown event types. */
	export interface CodexEventUnknown {
		type: string & {};
	}

	export type CodexEvent =
		| CodexEventItemStarted
		| CodexEventItemCompleted
		| CodexEventAgentMessageDelta
		| CodexEventTurnCompleted
		| CodexEventUnknown;

	export interface ThreadOptions {
		workingDirectory?: string;
		skipGitRepoCheck?: boolean;
	}

	export interface Thread {
		/** Thread ID. May be null before the first run is executed. */
		id: string | null;
		run(prompt: string, options?: { outputSchema?: unknown }): Promise<Turn>;
		runStreamed(prompt: string): Promise<{ events: AsyncGenerator<CodexEvent, void> }>;
	}

	export interface Codex {
		startThread(options?: ThreadOptions): Thread;
		resumeThread(id: string): Thread;
	}

	export const Codex: {
		new (options?: CodexOptions): Codex;
	};
}
