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
 * For new sessions the ID is pre-assigned via crypto.randomUUID() so it is
 * available immediately on session.id without waiting for a prompt response.
 * For resumed sessions the ID is the one passed to resumeSession().
 */
export class ClaudeSession implements OmniSession {
	private readonly _config: ClaudeAgentConfig;
	private readonly _sessionId: string;
	/** True when the next prompt should use `resume` rather than `sessionId`. */
	private _shouldResume: boolean;
	private _disposed = false;
	private _currentStream: ClaudeStream | undefined;

	constructor(config: ClaudeAgentConfig, sessionId: string, isResume: boolean) {
		this._config = config;
		this._sessionId = sessionId;
		// Resumed sessions always use `resume`; new sessions use `sessionId` on the
		// first prompt then switch to `resume` for all subsequent turns.
		this._shouldResume = isResume;
	}

	// ---------------------------------------------------------------------------
	// OmniSession: id
	// ---------------------------------------------------------------------------

	get id(): string {
		return this._sessionId;
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

		const queryOptions = mapConfig(this._config, {
			model: input.model,
			systemPrompt: input.systemPrompt,
			maxTurns: input.maxTurns,
			maxBudgetUsd: input.maxBudgetUsd,
		});

		queryOptions.includePartialMessages = true;

		if (this._shouldResume) {
			queryOptions.resume = this._sessionId;
		} else {
			queryOptions.sessionId = this._sessionId;
			this._shouldResume = true;
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
		return stream;
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
