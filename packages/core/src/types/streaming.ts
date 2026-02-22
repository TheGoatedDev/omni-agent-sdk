import type { OmniAgentError } from "../errors.js";
import type { OmniMessage, PromptResult } from "./message.js";
import type { OmniUsage } from "./usage.js";

export type OmniEvent =
	| { type: "text_delta"; text: string }
	| { type: "tool_start"; toolName: string; toolId: string; input?: unknown }
	| { type: "tool_end"; toolId: string; output?: unknown; isError: boolean }
	| { type: "message_start"; role: "assistant" | "system" }
	| { type: "message_end"; message: OmniMessage }
	| { type: "turn_start" }
	| { type: "turn_end"; usage?: OmniUsage }
	| { type: "error"; error: OmniAgentError };

export interface OmniStream extends AsyncDisposable {
	[Symbol.asyncIterator](): AsyncIterator<OmniEvent>;
	result(): Promise<PromptResult>;
	abort(): Promise<void>;
}
