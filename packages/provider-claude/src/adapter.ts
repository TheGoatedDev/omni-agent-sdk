import type { CreateSessionOptions, OmniAgent, ResumeSessionOptions } from "@omni-agent-sdk/core";
import { ClaudeSession } from "./session.js";
import type { ClaudeAgentConfig } from "./types.js";

/**
 * ClaudeAgent implements OmniAgent for the @anthropic-ai/claude-agent-sdk provider.
 * It is stateless; all per-session state lives in ClaudeSession instances.
 */
export class ClaudeAgent implements OmniAgent {
	readonly provider = "claude";

	private readonly _config: ClaudeAgentConfig;

	constructor(config: ClaudeAgentConfig) {
		this._config = config;
	}

	// ---------------------------------------------------------------------------
	// OmniAgent: createSession()
	// ---------------------------------------------------------------------------

	async createSession(options?: CreateSessionOptions): Promise<ClaudeSession> {
		const merged = this._mergeOptions(options);
		return new ClaudeSession(merged);
	}

	// ---------------------------------------------------------------------------
	// OmniAgent: resumeSession()
	// ---------------------------------------------------------------------------

	async resumeSession(sessionId: string, options?: ResumeSessionOptions): Promise<ClaudeSession> {
		const merged = this._mergeOptions(options);
		return new ClaudeSession(merged, sessionId);
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
