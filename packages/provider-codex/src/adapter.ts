import type {
	CreateSessionOptions,
	OmniAgent,
	OmniSession,
	ResumeSessionOptions,
} from "@omni-agent-sdk/core";
import { Codex } from "@openai/codex-sdk";
import { buildCodexOptions } from "./mappers/config.js";
import { CodexSession } from "./session.js";
import type { CodexAgentConfig } from "./types.js";

/**
 * CodexAgent implements OmniAgent by wrapping a Codex instance.
 *
 * Each agent holds a single Codex client configured from the provided
 * CodexAgentConfig. Sessions map 1:1 to Codex threads.
 */
export class CodexAgent implements OmniAgent {
	readonly provider = "codex";

	readonly #codex: Codex;
	readonly #config: CodexAgentConfig;

	constructor(config: CodexAgentConfig) {
		this.#config = config;
		const codexOptions = buildCodexOptions(config);
		this.#codex = new Codex(codexOptions);
	}

	/**
	 * Create a new session by starting a new Codex thread.
	 *
	 * The working directory for the thread is resolved from (in priority order):
	 * 1. options.cwd
	 * 2. config.cwd
	 */
	async createSession(options?: CreateSessionOptions): Promise<OmniSession> {
		const cwd = options?.cwd ?? this.#config.cwd;
		const providerOpts = this.#config.providerOptions as { skipGitRepoCheck?: boolean } | undefined;
		const threadOptions: { workingDirectory?: string; skipGitRepoCheck?: boolean } = {};
		if (cwd !== undefined) {
			threadOptions.workingDirectory = cwd;
		}
		if (providerOpts?.skipGitRepoCheck !== undefined) {
			threadOptions.skipGitRepoCheck = providerOpts.skipGitRepoCheck;
		}
		const thread = this.#codex.startThread(
			Object.keys(threadOptions).length > 0 ? threadOptions : undefined,
		);
		return new CodexSession(thread, this.#config);
	}

	/**
	 * Resume an existing session by ID.
	 *
	 * The Codex SDK's resumeThread() does not accept a working directory;
	 * the thread retains its original working directory.
	 */
	async resumeSession(sessionId: string, _options?: ResumeSessionOptions): Promise<OmniSession> {
		const thread = this.#codex.resumeThread(sessionId);
		return new CodexSession(thread, this.#config);
	}

	/** No persistent resources to clean up. */
	async dispose(): Promise<void> {
		// no-op
	}
}
