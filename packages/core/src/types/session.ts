import type { JsonSchema } from "./config.js";
import type { PromptResult } from "./message.js";
import type { OmniStream } from "./streaming.js";

export interface PromptInput {
	message: string;
	model?: string;
	systemPrompt?: string;
	outputSchema?: JsonSchema;
	maxTurns?: number;
	maxBudgetUsd?: number;
	signal?: AbortSignal;
	providerOptions?: Record<string, unknown>;
}

export interface OmniSession {
	readonly id: string;
	/** Collect all events and return the final result. Implemented as promptStreaming().result(). */
	prompt(input: PromptInput): Promise<PromptResult>;
	/** Returns a stream of events. Iterate with for-await or call .result() for the full result. */
	promptStreaming(input: PromptInput): OmniStream;
	abort(): Promise<void>;
	dispose(): Promise<void>;
}
