import {
	AbortError,
	OmniAgentError,
	type OmniEvent,
	type OmniMessage,
	type OmniStream,
	type OmniUsage,
	type PromptResult,
} from "@omni-agent-sdk/core";
import type { CodexEvent, ThreadItem } from "@openai/codex-sdk";
import { mapCodexEvent } from "./mappers/event.js";

const PROVIDER = "codex";

/**
 * CodexStream implements OmniStream by consuming the AsyncGenerator of
 * CodexEvents produced by thread.runStreamed().
 *
 * The stream accumulates messages and usage as events arrive. Callers can
 * iterate with `for await` to receive OmniEvents, or call `.result()` to
 * obtain the final PromptResult after iteration completes.
 */
export class CodexStream implements OmniStream {
	readonly #sessionId: string;
	readonly #events: AsyncGenerator<CodexEvent, void>;
	#aborted = false;
	#done = false;

	// Accumulated state built up during streaming
	#messages: OmniMessage[] = [];
	#lastUsage: OmniUsage | undefined;
	#finalText = "";
	#isError = false;

	// Text parts accumulated from item/agentMessage/delta events (older SDK versions).
	// Newer SDK versions (≥0.104) deliver the full text in item.completed instead.
	#pendingTextParts: string[] = [];

	constructor(sessionId: string, events: AsyncGenerator<CodexEvent, void>) {
		this.#sessionId = sessionId;
		this.#events = events;
	}

	async *[Symbol.asyncIterator](): AsyncIterator<OmniEvent> {
		if (this.#done) {
			return;
		}

		const turnStart: OmniEvent = { type: "turn_start" };
		yield turnStart;

		try {
			for await (const rawEvent of this.#events) {
				if (this.#aborted) {
					break;
				}

				// Track raw events to accumulate state for result()
				this.#trackAccumulationState(rawEvent);

				const omniEvents = mapCodexEvent(rawEvent);

				for (const omniEvent of omniEvents) {
					// Accumulate messages and usage as they arrive
					if (omniEvent.type === "message_end") {
						this.#messages.push(omniEvent.message);
					} else if (omniEvent.type === "turn_end" && omniEvent.usage !== undefined) {
						this.#lastUsage = omniEvent.usage;
					}

					yield omniEvent;
				}
			}
		} catch (err: unknown) {
			this.#isError = true;
			const omniErr =
				err instanceof OmniAgentError
					? err
					: new OmniAgentError(err instanceof Error ? err.message : "Unknown streaming error", {
							provider: PROVIDER,
							code: "PROVIDER_ERROR",
							raw: err,
						});
			const errorEvent: OmniEvent = { type: "error", error: omniErr };
			yield errorEvent;
		} finally {
			this.#done = true;
		}
	}

	/**
	 * Track raw events to build the final text for result() even when the
	 * caller doesn't iterate every event (e.g. when calling result() directly).
	 *
	 * Handles both camelCase (legacy) and snake_case (live SDK ≥0.104) item type
	 * names, and both the `text` field (live SDK) and `content` field (older SDK).
	 */
	#trackAccumulationState(event: CodexEvent): void {
		const eventType = event.type;

		if (eventType === "item/agentMessage/delta") {
			const delta = (event as { type: "item/agentMessage/delta"; delta: string }).delta;
			this.#pendingTextParts.push(delta);
		} else if (eventType === "item.completed") {
			const item = (event as { type: "item.completed"; item: ThreadItem }).item;
			const isAgentMsg = item.type === "agentMessage" || item.type === "agent_message";
			if (isAgentMsg) {
				// Prefer `text` (live SDK ≥0.104) over `content` (earlier SDK drafts).
				// Fall back to accumulated delta parts if neither field is present.
				this.#finalText = item.text ?? item.content ?? this.#pendingTextParts.join("");
				this.#pendingTextParts = [];
			}
		}
	}

	/**
	 * Consume all remaining events and return the final PromptResult.
	 * Safe to call without iterating first; also safe after full iteration.
	 */
	async result(): Promise<PromptResult> {
		if (!this.#done) {
			// Drain the iterator to accumulate all state
			for await (const _event of this) {
				// Side effects are handled inside the generator
			}
		}

		if (this.#aborted) {
			throw new AbortError({ provider: PROVIDER });
		}

		return {
			sessionId: this.#sessionId,
			messages: this.#messages,
			text: this.#finalText,
			isError: this.#isError,
			usage: this.#lastUsage ?? {},
		};
	}

	async abort(): Promise<void> {
		this.#aborted = true;
		// The Codex SDK does not expose a cancellation handle on the event
		// generator, so we set the flag and let the iteration loop break on the
		// next event boundary.
	}

	async [Symbol.asyncDispose](): Promise<void> {
		await this.abort();
	}
}
