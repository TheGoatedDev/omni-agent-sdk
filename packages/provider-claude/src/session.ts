import { query } from "@anthropic-ai/claude-agent-sdk";
import { OmniAgentError } from "@omni-agent-sdk/core";
import type { OmniSession, OmniStream, PromptInput, PromptResult } from "@omni-agent-sdk/core";
import { mapConfig } from "./mappers/config.js";
import { ClaudeStream } from "./stream.js";
import type { ClaudeAgentConfig } from "./types.js";

const PROVIDER = "claude";

/**
 * ClaudeSession implements OmniSession for the claude-agent-sdk provider.
 *
 * The session ID is lazily resolved from the first streaming message and
 * cached so subsequent prompts resume the same conversation.
 */
export class ClaudeSession implements OmniSession {
	private readonly _config: ClaudeAgentConfig;
	private _sessionId: string | undefined;
	private _disposed = false;
	private _currentStream: ClaudeStream | undefined;

	constructor(config: ClaudeAgentConfig, resumeSessionId?: string) {
		this._config = config;
		this._sessionId = resumeSessionId;
	}

	// ---------------------------------------------------------------------------
	// OmniSession: id
	// ---------------------------------------------------------------------------

	/**
	 * The resolved session ID. Returns an empty string before the first prompt
	 * completes; populated after the first ClaudeStream resolves a session_id.
	 */
	get id(): string {
		return this._sessionId ?? "";
	}

	// ---------------------------------------------------------------------------
	// OmniSession: prompt()
	// ---------------------------------------------------------------------------

	async prompt(input: PromptInput): Promise<PromptResult> {
		return this.promptStreaming(input).result();
	}

	// ---------------------------------------------------------------------------
	// OmniSession: promptStreaming()
	// ---------------------------------------------------------------------------

	promptStreaming(input: PromptInput): OmniStream {
		if (this._disposed) {
			throw new OmniAgentError("Session has been disposed", {
				provider: PROVIDER,
				code: "PROVIDER_ERROR",
			});
		}

		// Merge session-level config with prompt-level overrides
		const queryOptions = mapConfig(this._config, {
			model: input.model,
			systemPrompt: input.systemPrompt,
			maxTurns: input.maxTurns,
			maxBudgetUsd: input.maxBudgetUsd,
		});

		// Enable streaming partial messages for real-time event emission
		queryOptions.includePartialMessages = true;

		// Resume an existing session if we have one
		if (this._sessionId !== undefined) {
			queryOptions.resume = this._sessionId;
		}

		let claudeQuery: import("@anthropic-ai/claude-agent-sdk").Query;
		try {
			claudeQuery = query({ prompt: input.message, options: queryOptions });
		} catch (err) {
			throw new OmniAgentError("Failed to start claude-agent-sdk query", {
				provider: PROVIDER,
				code: "PROVIDER_ERROR",
				cause: err instanceof Error ? err : undefined,
				raw: err,
			});
		}

		const stream = new ClaudeStream(claudeQuery, input.signal);
		this._currentStream = stream;
		return wrapStreamForSessionCapture(stream, (sid) => {
			if (this._sessionId === undefined) {
				this._sessionId = sid;
			}
		});
	}

	// ---------------------------------------------------------------------------
	// OmniSession: abort()
	// ---------------------------------------------------------------------------

	async abort(): Promise<void> {
		if (this._currentStream !== undefined) {
			await this._currentStream.abort();
		}
	}

	// ---------------------------------------------------------------------------
	// OmniSession: dispose()
	// ---------------------------------------------------------------------------

	async dispose(): Promise<void> {
		if (!this._disposed) {
			this._disposed = true;
			await this.abort();
		}
	}
}

// ---------------------------------------------------------------------------
// Internal helper: session ID capture wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps a ClaudeStream to capture the resolved session ID after the stream
 * is fully consumed (either via async iteration or result()).
 */
function wrapStreamForSessionCapture(
	inner: ClaudeStream,
	onSessionId: (id: string) => void,
): OmniStream {
	function captureFromResult(result: PromptResult): PromptResult {
		if (result.sessionId.length > 0) {
			onSessionId(result.sessionId);
		}
		return result;
	}

	const wrapper: OmniStream = {
		async *[Symbol.asyncIterator]() {
			for await (const event of inner) {
				yield event;
			}
			// Capture session ID after iteration completes
			const sid = inner.sessionId;
			if (sid !== undefined && sid.length > 0) {
				onSessionId(sid);
			}
		},

		async result(): Promise<PromptResult> {
			const result = await inner.result();
			return captureFromResult(result);
		},

		async abort(): Promise<void> {
			await inner.abort();
		},

		async [Symbol.asyncDispose](): Promise<void> {
			await inner.abort();
		},
	};

	return wrapper;
}
