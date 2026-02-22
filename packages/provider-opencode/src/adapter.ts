import type {
	CreateSessionOptions,
	OmniAgent,
	ResumeSessionOptions,
	SessionInfo,
} from "@omni-agent-sdk/core";
import { OmniAgentError } from "@omni-agent-sdk/core";
import type { OpenCodeClient } from "@opencode-ai/sdk";
import { OpenCodeSession } from "./session.js";
import type { OpenCodeAgentConfig, OpenCodeProviderOptions } from "./types.js";

const PROVIDER = "opencode";

/**
 * OpenCodeAgent implements OmniAgent for the @opencode-ai/sdk provider.
 *
 * The SDK client is lazily initialized on the first call to createSession()
 * or resumeSession(), since createOpencode() is async (it starts an embedded
 * server). This keeps the constructor synchronous, matching the Claude/Codex pattern.
 *
 * Mode selection:
 *   - If providerOptions.baseUrl is set: client-only mode via createOpencodeClient()
 *   - Otherwise: embedded mode via createOpencode() (starts a local server)
 */
export class OpenCodeAgent implements OmniAgent {
	readonly provider = "opencode";

	private readonly _config: OpenCodeAgentConfig;
	/** Lazily initialized client promise, shared across all session creations. */
	private _clientPromise: Promise<OpenCodeClient> | undefined;
	/** Shutdown function, only available in embedded mode. */
	private _dispose: (() => Promise<void>) | undefined;

	constructor(config: OpenCodeAgentConfig) {
		this._config = config;
	}

	// ---------------------------------------------------------------------------
	// OmniAgent: createSession()
	// ---------------------------------------------------------------------------

	async createSession(options?: CreateSessionOptions): Promise<OpenCodeSession> {
		const client = await this._getClient();
		const merged = this._mergeOptions(options);

		let sessionInfo: import("@opencode-ai/sdk").OpenCodeSessionInfo;
		try {
			sessionInfo = await client.session.create();
		} catch (err) {
			throw new OmniAgentError("Failed to create OpenCode session", {
				provider: PROVIDER,
				code: "PROVIDER_ERROR",
				cause: err instanceof Error ? err : undefined,
				raw: err,
			});
		}

		return new OpenCodeSession(client, sessionInfo.id, merged);
	}

	// ---------------------------------------------------------------------------
	// OmniAgent: resumeSession()
	// ---------------------------------------------------------------------------

	async resumeSession(sessionId: string, options?: ResumeSessionOptions): Promise<OpenCodeSession> {
		const client = await this._getClient();
		const merged = this._mergeOptions(options);

		// Verify the session exists on the server
		try {
			await client.session.get(sessionId);
		} catch (err) {
			throw new OmniAgentError(`Session not found: ${sessionId}`, {
				provider: PROVIDER,
				code: "SESSION_NOT_FOUND",
				cause: err instanceof Error ? err : undefined,
				raw: err,
			});
		}

		return new OpenCodeSession(client, sessionId, merged);
	}

	// ---------------------------------------------------------------------------
	// OmniAgent: listSessions()
	// ---------------------------------------------------------------------------

	async listSessions(): Promise<SessionInfo[]> {
		const client = await this._getClient();

		let sessions: import("@opencode-ai/sdk").OpenCodeSessionInfo[];
		try {
			sessions = await client.session.list();
		} catch (err) {
			throw new OmniAgentError("Failed to list OpenCode sessions", {
				provider: PROVIDER,
				code: "PROVIDER_ERROR",
				cause: err instanceof Error ? err : undefined,
				raw: err,
			});
		}

		return sessions.map((s) => ({
			id: s.id,
			createdAt: s.createdAt !== undefined ? new Date(s.createdAt) : undefined,
			metadata: s.title !== undefined ? { title: s.title } : undefined,
		}));
	}

	// ---------------------------------------------------------------------------
	// OmniAgent: dispose()
	// ---------------------------------------------------------------------------

	async dispose(): Promise<void> {
		if (this._dispose !== undefined) {
			await this._dispose();
			this._dispose = undefined;
		}
		this._clientPromise = undefined;
	}

	// ---------------------------------------------------------------------------
	// Internals
	// ---------------------------------------------------------------------------

	/**
	 * Lazily initialize and return the OpenCode client.
	 * Shared across all session creations — the embedded server is started only once.
	 */
	private _getClient(): Promise<OpenCodeClient> {
		if (this._clientPromise === undefined) {
			this._clientPromise = this._initClient();
		}
		return this._clientPromise;
	}

	private async _initClient(): Promise<OpenCodeClient> {
		const providerOptions = (this._config.providerOptions ?? {}) as OpenCodeProviderOptions;

		if (providerOptions.baseUrl !== undefined) {
			// Client-only mode: connect to an existing OpenCode server
			const { createOpencodeClient } = await import("@opencode-ai/sdk");
			return createOpencodeClient({ baseUrl: providerOptions.baseUrl });
		}

		// Embedded mode: start a local OpenCode server
		const { createOpencode } = await import("@opencode-ai/sdk");
		const server = await createOpencode({
			hostname: providerOptions.hostname,
			port: providerOptions.port,
			timeout: providerOptions.timeout,
		});
		this._dispose = server.dispose.bind(server);
		return server.client;
	}

	/**
	 * Merges session-level option overrides on top of the base agent config.
	 */
	private _mergeOptions(
		options?: CreateSessionOptions | ResumeSessionOptions,
	): OpenCodeAgentConfig {
		if (options === undefined) {
			return this._config;
		}
		return {
			...this._config,
			...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
			...(options.providerOptions !== undefined
				? {
						providerOptions: {
							...this._config.providerOptions,
							...options.providerOptions,
						},
					}
				: {}),
		};
	}
}
