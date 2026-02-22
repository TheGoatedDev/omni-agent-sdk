import type { Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { BudgetExceededError, OmniAgentError } from "@omni-agent-sdk/core";
import type {
	OmniEvent,
	OmniMessage,
	OmniStream,
	OmniUsage,
	PromptResult,
} from "@omni-agent-sdk/core";
import { createEventMapperState, mapStreamEvent } from "./mappers/event.js";
import { mapAssistantMessage, mapResultUsage } from "./mappers/message.js";

const PROVIDER = "claude";

/**
 * ClaudeStream implements OmniStream by consuming the Query (AsyncGenerator)
 * returned by the claude-agent-sdk `query()` function and translating
 * each message / stream event into the OmniEvent vocabulary.
 */
export class ClaudeStream implements OmniStream {
	private readonly _query: Query;

	/** Lazily resolved from the first stream_event or result message. */
	private _sessionId: string | undefined;

	/** Accumulated completed assistant messages. */
	private readonly _messages: OmniMessage[] = [];

	/** Finalized result, set when SDKResultMessage is received. */
	private _result: PromptResult | undefined;

	/** Whether the underlying generator has been fully consumed. */
	private _done = false;

	/** Whether abort() was called before the stream finished. */
	private _aborted = false;

	/** Whether [Symbol.asyncIterator] has been called. */
	private _iterating = false;

	constructor(query: Query, externalSignal?: AbortSignal) {
		this._query = query;

		if (externalSignal !== undefined) {
			if (externalSignal.aborted) {
				void this._query.return(undefined);
				this._aborted = true;
				this._done = true;
			} else {
				externalSignal.addEventListener(
					"abort",
					() => {
						void this.abort();
					},
					{ once: true },
				);
			}
		}
	}

	// ---------------------------------------------------------------------------
	// OmniStream: [Symbol.asyncIterator]
	// ---------------------------------------------------------------------------

	async *[Symbol.asyncIterator](): AsyncIterator<OmniEvent> {
		if (this._iterating) {
			throw new OmniAgentError("ClaudeStream can only be iterated once", {
				provider: PROVIDER,
				code: "PROVIDER_ERROR",
			});
		}
		this._iterating = true;

		// Emit the synthetic turn_start immediately
		yield { type: "turn_start" };

		const eventState = createEventMapperState();

		for await (const sdkMessage of this._query) {
			if (this._aborted) {
				break;
			}

			// Extract session ID as early as possible
			if (this._sessionId === undefined) {
				const sid = extractSessionId(sdkMessage);
				if (sid !== undefined) {
					this._sessionId = sid;
				}
			}

			if (sdkMessage.type === "stream_event") {
				const omniEvents = mapStreamEvent(sdkMessage.event, eventState);
				for (const ev of omniEvents) {
					yield ev;
				}
			} else if (sdkMessage.type === "assistant") {
				const omniMessage = mapAssistantMessage(sdkMessage);
				this._messages.push(omniMessage);
				yield { type: "message_end", message: omniMessage };
			} else if (sdkMessage.type === "result") {
				const usage = mapResultUsage(sdkMessage);

				if (this._sessionId === undefined) {
					this._sessionId = sdkMessage.session_id;
				}

				if (sdkMessage.is_error) {
					yield { type: "turn_end", usage };
					const omniError = mapResultError(sdkMessage.subtype, usage);
					yield { type: "error", error: omniError };
				} else {
					this._result = {
						sessionId: this._sessionId ?? "",
						messages: [...this._messages],
						text: collectText(this._messages),
						isError: false,
						structuredOutput: hasStructuredOutput(sdkMessage)
							? sdkMessage.structured_output
							: undefined,
						usage,
						raw: sdkMessage,
					};
					yield { type: "turn_end", usage };
				}
			}
			// "user", "user_message_replay", "system", "compact_boundary", and other
			// status/hook messages have no OmniEvent mapping.
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
			// eslint-disable-next-line no-empty
			for await (const _ of this) {
				// consume
			}
		}

		if (this._aborted) {
			throw new OmniAgentError("Stream was aborted before a result was received", {
				provider: PROVIDER,
				code: "ABORT",
			});
		}

		if (this._result === undefined) {
			throw new OmniAgentError("Stream ended without a result message", {
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
		this._query.close();
		this._done = true;
	}

	// ---------------------------------------------------------------------------
	// AsyncDisposable
	// ---------------------------------------------------------------------------

	async [Symbol.asyncDispose](): Promise<void> {
		await this.abort();
	}

	// ---------------------------------------------------------------------------
	// Accessors
	// ---------------------------------------------------------------------------

	/** The session ID, available after the first stream event is received. */
	get sessionId(): string | undefined {
		return this._sessionId;
	}
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function extractSessionId(msg: SDKMessage): string | undefined {
	if ("session_id" in msg && typeof msg.session_id === "string" && msg.session_id.length > 0) {
		return msg.session_id;
	}
	return undefined;
}

function collectText(messages: OmniMessage[]): string {
	const parts: string[] = [];
	for (const msg of messages) {
		for (const block of msg.content) {
			if (block.type === "text") {
				parts.push(block.text);
			}
		}
	}
	return parts.join("");
}

function hasStructuredOutput(msg: unknown): msg is { structured_output: unknown } {
	return typeof msg === "object" && msg !== null && "structured_output" in msg;
}

function mapResultError(subtype: string, usage: OmniUsage): OmniAgentError {
	if (subtype === "error_max_budget_usd") {
		return new BudgetExceededError({
			provider: PROVIDER,
			raw: { subtype, usage },
		});
	}
	if (subtype === "error_max_turns") {
		return new OmniAgentError("Maximum number of turns reached", {
			provider: PROVIDER,
			code: "TURN_LIMIT",
			raw: { subtype, usage },
		});
	}
	return new OmniAgentError(`Agent execution failed: ${subtype}`, {
		provider: PROVIDER,
		code: "PROVIDER_ERROR",
		raw: { subtype, usage },
	});
}
