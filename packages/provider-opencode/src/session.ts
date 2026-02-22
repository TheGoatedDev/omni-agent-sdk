import type { OmniSession, OmniStream, PromptInput, PromptResult } from "@omni-agent-sdk/core";
import { OmniAgentError } from "@omni-agent-sdk/core";
import type { OpenCodeClient } from "@opencode-ai/sdk";
import { buildPromptBody } from "./mappers/config.js";
import { buildPromptResult } from "./mappers/message.js";
import { OpenCodeStream } from "./stream.js";
import type { OpenCodeAgentConfig } from "./types.js";

const PROVIDER = "opencode";

/**
 * OpenCodeSession implements OmniSession for the @opencode-ai/sdk provider.
 *
 * Unlike Claude (where session ID is lazily resolved from the first stream event),
 * the OpenCode session ID is known immediately after session creation because
 * the REST API assigns it at `client.session.create()` time.
 */
export class OpenCodeSession implements OmniSession {
	private readonly _client: OpenCodeClient;
	private readonly _sessionId: string;
	private readonly _config: OpenCodeAgentConfig;
	private _disposed = false;
	private _currentStream: OpenCodeStream | undefined;

	constructor(client: OpenCodeClient, sessionId: string, config: OpenCodeAgentConfig) {
		this._client = client;
		this._sessionId = sessionId;
		this._config = config;
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
		if (this._disposed) {
			throw new OmniAgentError("Session has been disposed", {
				provider: PROVIDER,
				code: "PROVIDER_ERROR",
			});
		}

		const body = buildPromptBody(input.message, this._config, {
			model: input.model,
			systemPrompt: input.systemPrompt,
			maxTurns: input.maxTurns,
			maxBudgetUsd: input.maxBudgetUsd,
		});

		let response: import("@opencode-ai/sdk").PromptResponse;
		try {
			response = await this._client.session.prompt(this._sessionId, body);
		} catch (err) {
			throw new OmniAgentError("OpenCode session.prompt() failed", {
				provider: PROVIDER,
				code: "PROVIDER_ERROR",
				cause: err instanceof Error ? err : undefined,
				raw: err,
			});
		}

		return buildPromptResult(response, this._sessionId);
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

		const body = buildPromptBody(input.message, this._config, {
			model: input.model,
			systemPrompt: input.systemPrompt,
			maxTurns: input.maxTurns,
			maxBudgetUsd: input.maxBudgetUsd,
		});

		const client = this._client;
		const sessionId = this._sessionId;

		const triggerPrompt = async (): Promise<void> => {
			await client.session.promptAsync(sessionId, body);
		};

		const stream = new OpenCodeStream(client, sessionId, triggerPrompt, input.signal);
		this._currentStream = stream;
		return stream;
	}

	// ---------------------------------------------------------------------------
	// OmniSession: abort()
	// ---------------------------------------------------------------------------

	async abort(): Promise<void> {
		// Abort the current stream (stops SSE consumption)
		if (this._currentStream !== undefined) {
			await this._currentStream.abort();
		}
		// Signal the server to stop processing
		try {
			await this._client.session.abort(this._sessionId);
		} catch {
			// Best-effort — server abort failures are non-fatal
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
