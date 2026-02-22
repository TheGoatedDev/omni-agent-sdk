import type {
	OmniEvent,
	OmniMessage,
	OmniStream,
	OmniUsage,
	PromptResult,
} from "@omni-agent-sdk/core";
import { OmniAgentError } from "@omni-agent-sdk/core";
import type { OpenCodeClient } from "@opencode-ai/sdk";
import { getEventSessionId, isTerminalOpenCodeEvent, mapOpenCodeEvent } from "./mappers/event.js";
import { collectText } from "./mappers/message.js";

const PROVIDER = "opencode";

/**
 * OpenCodeStream implements OmniStream by consuming the global SSE event stream
 * from the OpenCode SDK and filtering for events belonging to the target session.
 *
 * The streaming flow:
 *   1. Subscribe to the global SSE event stream (before sending the prompt)
 *   2. Call promptAsync() to fire the prompt (fire-and-forget)
 *   3. Filter incoming events by sessionID
 *   4. Map filtered events to OmniEvents
 *   5. Stop when EventSessionIdle or EventSessionError is received for our session
 */
export class OpenCodeStream implements OmniStream {
	private readonly _client: OpenCodeClient;
	private readonly _sessionId: string;
	/** Async function that triggers promptAsync() when called. */
	private readonly _triggerPrompt: () => Promise<void>;
	private readonly _externalSignal: AbortSignal | undefined;

	/** Accumulated assistant messages (populated from message_end events). */
	private readonly _messages: OmniMessage[] = [];

	/** Finalized result, set when the stream terminates successfully. */
	private _result: PromptResult | undefined;

	/** Final usage, captured from turn_end event. */
	private _lastUsage: OmniUsage | undefined;

	/** Whether this stream ended due to a session error. */
	private _isError = false;

	/** Whether the underlying generator has been fully consumed. */
	private _done = false;

	/** Whether abort() was called before the stream finished. */
	private _aborted = false;

	/** Whether [Symbol.asyncIterator] has been called. */
	private _iterating = false;

	constructor(
		client: OpenCodeClient,
		sessionId: string,
		triggerPrompt: () => Promise<void>,
		externalSignal?: AbortSignal,
	) {
		this._client = client;
		this._sessionId = sessionId;
		this._triggerPrompt = triggerPrompt;
		this._externalSignal = externalSignal;

		if (externalSignal?.aborted === true) {
			this._aborted = true;
			this._done = true;
		}
	}

	// ---------------------------------------------------------------------------
	// OmniStream: [Symbol.asyncIterator]
	// ---------------------------------------------------------------------------

	async *[Symbol.asyncIterator](): AsyncIterator<OmniEvent> {
		if (this._iterating) {
			throw new OmniAgentError("OpenCodeStream can only be iterated once", {
				provider: PROVIDER,
				code: "PROVIDER_ERROR",
			});
		}
		this._iterating = true;

		if (this._aborted) {
			return;
		}

		// Wire up external abort signal
		if (this._externalSignal !== undefined) {
			this._externalSignal.addEventListener("abort", () => void this.abort(), { once: true });
		}

		// Emit turn_start before subscribing to events
		yield { type: "turn_start" };

		// Subscribe to the global event stream BEFORE firing the prompt.
		// This ensures we do not miss any events that arrive immediately after promptAsync().
		const eventIterable = this._client.event.subscribe();

		// Fire the async prompt (fire-and-forget; events arrive via SSE)
		// We intentionally do not await here — errors from promptAsync are surfaced
		// through session.error SSE events, not as thrown exceptions.
		this._triggerPrompt().catch(() => {
			// Errors from promptAsync manifest as session.error SSE events.
			// If the SSE stream ends without a terminal event, abort() will be called.
		});

		// Process SSE events, filtering by our session ID
		for await (const event of eventIterable) {
			if (this._aborted) break;

			// Skip events that belong to other sessions
			const sid = getEventSessionId(event);
			if (sid !== undefined && sid !== this._sessionId) {
				continue;
			}

			const omniEvents = mapOpenCodeEvent(event);
			for (const ev of omniEvents) {
				// Accumulate state for result()
				if (ev.type === "message_end") {
					this._messages.push(ev.message);
				} else if (ev.type === "turn_end") {
					this._lastUsage = ev.usage;
				} else if (ev.type === "error") {
					this._isError = true;
				}

				yield ev;
			}

			// Break out of the loop on terminal events so we release the SSE connection
			if (isTerminalOpenCodeEvent(event)) {
				break;
			}
		}

		// Build the final result from accumulated state
		if (!this._aborted && !this._isError) {
			this._result = {
				sessionId: this._sessionId,
				messages: [...this._messages],
				text: collectText(this._messages),
				isError: false,
				usage: this._lastUsage ?? {},
				raw: undefined,
			};
		}

		this._done = true;
	}

	// ---------------------------------------------------------------------------
	// OmniStream: result()
	// ---------------------------------------------------------------------------

	async result(): Promise<PromptResult> {
		if (this._result !== undefined) {
			return this._result;
		}

		if (!this._done && !this._iterating) {
			// Drain by consuming all events — this also populates this._result
			for await (const _event of this) {
				// consume
			}
		}

		if (this._aborted) {
			throw new OmniAgentError("Stream was aborted before a result was received", {
				provider: PROVIDER,
				code: "ABORT",
			});
		}

		if (this._isError) {
			throw new OmniAgentError("Session ended with an error", {
				provider: PROVIDER,
				code: "PROVIDER_ERROR",
			});
		}

		if (this._result === undefined) {
			throw new OmniAgentError("Stream ended without a result", {
				provider: PROVIDER,
				code: "PROVIDER_ERROR",
			});
		}

		return this._result;
	}

	// ---------------------------------------------------------------------------
	// OmniStream: abort()
	// ---------------------------------------------------------------------------

	async abort(): Promise<void> {
		if (this._aborted) {
			return;
		}
		this._aborted = true;
		this._done = true;
	}

	// ---------------------------------------------------------------------------
	// AsyncDisposable
	// ---------------------------------------------------------------------------

	async [Symbol.asyncDispose](): Promise<void> {
		await this.abort();
	}
}
