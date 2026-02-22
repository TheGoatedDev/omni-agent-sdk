import type { OmniUsage } from "./usage.js";

export type OmniContentBlock =
	| { type: "text"; text: string }
	| { type: "tool_use"; toolName: string; toolId: string; input: unknown }
	| { type: "tool_result"; toolId: string; output: unknown; isError: boolean }
	| { type: "reasoning"; text: string }
	| {
			type: "file_change";
			path: string;
			operation: "create" | "edit" | "delete";
			diff?: string;
	  };

export interface OmniMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: OmniContentBlock[];
	createdAt?: Date;
	raw?: unknown;
}

export interface PromptResult {
	sessionId: string;
	messages: OmniMessage[];
	/** Convenience: final text response */
	text: string;
	isError: boolean;
	structuredOutput?: unknown;
	usage: OmniUsage;
	raw?: unknown;
}
