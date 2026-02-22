import type { CreateSessionOptions, OmniAgent, ResumeSessionOptions, SessionInfo } from "@omni-agent-sdk/core";
import { ClaudeSession } from "./session.js";
import { readDiskSessions } from "./session-store.js";
import type { ClaudeAgentConfig } from "./types.js";

/**
 * ClaudeAgent implements OmniAgent for the @anthropic-ai/claude-agent-sdk provider.
 * It is stateless; all per-session state lives in ClaudeSession instances.
 */
export class ClaudeAgent implements OmniAgent {
	readonly provider = "claude";

	private readonly _config: ClaudeAgentConfig;
	/** Sessions seen during this agent's lifetime: id → time first observed. */
	private readonly _seen = new Map<string, Date>();

	constructor(config: ClaudeAgentConfig) {
		this._config = config;
	}

	// ---------------------------------------------------------------------------
	// OmniAgent: createSession()
	// ---------------------------------------------------------------------------

	async createSession(options?: CreateSessionOptions): Promise<ClaudeSession> {
		const merged = this._mergeOptions(options);
		return new ClaudeSession(merged, undefined, (id) => {
			if (!this._seen.has(id)) this._seen.set(id, new Date());
		});
	}

	// ---------------------------------------------------------------------------
	// OmniAgent: resumeSession()
	// ---------------------------------------------------------------------------

	async resumeSession(sessionId: string, options?: ResumeSessionOptions): Promise<ClaudeSession> {
		if (!this._seen.has(sessionId)) this._seen.set(sessionId, new Date());
		const merged = this._mergeOptions(options);
		return new ClaudeSession(merged, sessionId, (id) => {
			if (!this._seen.has(id)) this._seen.set(id, new Date());
		});
	}

	// ---------------------------------------------------------------------------
	// OmniAgent: listSessions()
	// ---------------------------------------------------------------------------

	async listSessions(): Promise<SessionInfo[]> {
		const cwd = this._config.cwd ?? process.cwd();

		// Merge disk sessions and in-process sessions, disk entries take precedence
		// for createdAt since they reflect the actual session creation time.
		const byId = new Map<string, SessionInfo>();

		for (const session of await readDiskSessions(cwd)) {
			byId.set(session.id, session);
		}

		for (const [id, seenAt] of this._seen) {
			if (!byId.has(id)) {
				byId.set(id, { id, createdAt: seenAt });
			}
		}

		return [...byId.values()].sort((a, b) => {
			if (!a.createdAt) return 1;
			if (!b.createdAt) return -1;
			return a.createdAt.getTime() - b.createdAt.getTime();
		});
	}

	// ---------------------------------------------------------------------------
	// OmniAgent: dispose()
	// ---------------------------------------------------------------------------

	async dispose(): Promise<void> {
		// The claude-agent-sdk spawns a subprocess per query call; there is no
		// persistent connection to tear down at the agent level.
	}

	// ---------------------------------------------------------------------------
	// Internals
	// ---------------------------------------------------------------------------

	/**
	 * Merges session-level option overrides (cwd, providerOptions) on top of the
	 * base agent config, returning a new config object for the session.
	 */
	private _mergeOptions(options?: CreateSessionOptions | ResumeSessionOptions): ClaudeAgentConfig {
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
