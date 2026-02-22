import type { OmniSession, OmniStream, PromptInput, PromptResult } from "@omni-agent-sdk/core";
import { OmniAgentError } from "@omni-agent-sdk/core";
import type { CodexEvent, Thread } from "@openai/codex-sdk";
import { CodexStream } from "./stream.js";
import type { CodexAgentConfig } from "./types.js";

const PROVIDER = "codex";

/**
 * CodexSession wraps a Codex Thread and implements OmniSession.
 *
 * Each CodexSession corresponds to a single Codex thread. The thread ID is
 * used as the session ID, enabling callers to resume sessions via the agent.
 */
export class CodexSession implements OmniSession {
	readonly #thread: Thread;
	#aborted = false;

	constructor(thread: Thread, _config: CodexAgentConfig) {
		this.#thread = thread;
	}

	get id(): string {
		// Thread.id may be null before the first run; return empty string to satisfy the interface.
		return this.#thread.id ?? "";
	}

	/**
	 * Run a prompt and return the final PromptResult.
	 *
	 * Delegates to promptStreaming and collects the result, so the streaming
	 * and non-streaming paths share the same event pipeline and mapping logic.
	 */
	async prompt(input: PromptInput): Promise<PromptResult> {
		return this.promptStreaming(input).result();
	}

	/**
	 * Run a prompt in streaming mode and return an OmniStream.
	 *
	 * The returned stream emits OmniEvents as they arrive from the Codex SDK.
	 * Callers may iterate the stream or call .result() to get the final result.
	 */
	promptStreaming(input: PromptInput): OmniStream {
		const sessionId = this.id; // use the null-guarded getter
		const thread = this.#thread;
		const abortedRef = { value: this.#aborted };

		const lazyEvents = createLazyEventGenerator(thread, input.message, abortedRef);

		return new CodexStream(sessionId, lazyEvents);
	}

	/**
	 * Signal that the current operation should be aborted.
	 * Best-effort: the Codex SDK does not expose a cancellation handle.
	 */
	async abort(): Promise<void> {
		this.#aborted = true;
	}

	/** No resources to clean up at the session level. */
	async dispose(): Promise<void> {
		// no-op
	}
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface AbortedRef {
	value: boolean;
}

/**
 * Create a lazy async generator that calls thread.runStreamed() only when
 * the first value is requested. This keeps CodexSession.promptStreaming()
 * synchronous while still supporting async initialization.
 */
async function* createLazyEventGenerator(
	thread: Thread,
	message: string,
	abortedRef: AbortedRef,
): AsyncGenerator<CodexEvent, void> {
	if (abortedRef.value) {
		return;
	}

	let streamedResult: { events: AsyncGenerator<CodexEvent, void> };
	try {
		streamedResult = await thread.runStreamed(message);
	} catch (err: unknown) {
		throw new OmniAgentError(err instanceof Error ? err.message : "Failed to start streamed run", {
			provider: PROVIDER,
			code: "PROVIDER_ERROR",
			raw: err,
		});
	}

	for await (const event of streamedResult.events) {
		if (abortedRef.value) {
			return;
		}
		yield event;
	}
}
