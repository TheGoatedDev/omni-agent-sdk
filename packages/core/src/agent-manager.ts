import {
	AgentNotFoundError,
	AllAgentsFailedError,
	NoDefaultAgentError,
	OmniAgentError,
	type OmniErrorCode,
} from "./errors.js";
import type { CreateSessionOptions, OmniAgent, ResumeSessionOptions } from "./types/agent.js";
import type { OmniSession } from "./types/session.js";

export interface FallbackConfig {
	enabled: boolean;
	order?: string[];
	shouldFallback?: (error: OmniAgentError) => boolean;
}

export interface AgentManagerConfig {
	defaultAgent?: string;
	fallback?: FallbackConfig;
}

const FALLBACK_CODES: ReadonlySet<OmniErrorCode> = new Set(["PROVIDER_ERROR", "NETWORK"]);

function defaultShouldFallback(error: OmniAgentError): boolean {
	return FALLBACK_CODES.has(error.code);
}

export class AgentManager implements OmniAgent {
	readonly provider = "manager";

	private readonly _agents = new Map<string, OmniAgent>();
	private readonly _order: string[] = [];
	private _defaultAgentName: string | undefined;
	private readonly _config: AgentManagerConfig;

	constructor(config: AgentManagerConfig = {}) {
		this._config = config;
	}

	// ---------------------------------------------------------------------------
	// Registry
	// ---------------------------------------------------------------------------

	register(name: string, agent: OmniAgent): this {
		this._agents.set(name, agent);
		if (!this._order.includes(name)) {
			this._order.push(name);
		}
		// Auto-set default to the first registered agent
		if (this._defaultAgentName === undefined) {
			this._defaultAgentName = name;
		}
		return this;
	}

	unregister(name: string): boolean {
		if (!this._agents.has(name)) {
			return false;
		}
		this._agents.delete(name);
		const idx = this._order.indexOf(name);
		if (idx !== -1) {
			this._order.splice(idx, 1);
		}
		// Reassign default if needed
		if (this._defaultAgentName === name) {
			this._defaultAgentName = this._order[0];
		}
		return true;
	}

	agent(name: string): OmniAgent {
		const a = this._agents.get(name);
		if (a === undefined) {
			throw new AgentNotFoundError(name);
		}
		return a;
	}

	tryAgent(name: string): OmniAgent | undefined {
		return this._agents.get(name);
	}

	has(name: string): boolean {
		return this._agents.has(name);
	}

	agentNames(): readonly string[] {
		return [...this._order];
	}

	get size(): number {
		return this._agents.size;
	}

	[Symbol.iterator](): Iterator<[string, OmniAgent]> {
		const entries = this._order.map((name): [string, OmniAgent] => {
			// biome-ignore lint/style/noNonNullAssertion: _order is kept in sync with _agents
			return [name, this._agents.get(name)!];
		});
		let index = 0;
		return {
			next(): IteratorResult<[string, OmniAgent]> {
				if (index < entries.length) {
					// biome-ignore lint/style/noNonNullAssertion: index is bounds-checked
					return { value: entries[index++]!, done: false };
				}
				return { value: undefined as unknown as [string, OmniAgent], done: true };
			},
		};
	}

	// ---------------------------------------------------------------------------
	// Default management
	// ---------------------------------------------------------------------------

	get defaultAgentName(): string | undefined {
		return this._defaultAgentName;
	}

	set defaultAgentName(name: string) {
		if (!this._agents.has(name)) {
			throw new AgentNotFoundError(name);
		}
		this._defaultAgentName = name;
	}

	private getDefaultAgent(): OmniAgent {
		if (this._defaultAgentName === undefined) {
			throw new NoDefaultAgentError();
		}
		return this.agent(this._defaultAgentName);
	}

	// ---------------------------------------------------------------------------
	// OmniAgent facade — delegates to default agent
	// ---------------------------------------------------------------------------

	async createSession(options?: CreateSessionOptions): Promise<OmniSession> {
		const fallback = this._config.fallback;
		if (fallback?.enabled) {
			return this.withFallback((agent) => agent.createSession(options), fallback.order);
		}
		return this.getDefaultAgent().createSession(options);
	}

	async resumeSession(sessionId: string, options?: ResumeSessionOptions): Promise<OmniSession> {
		// Session IDs are provider-specific — no fallback, always delegate directly.
		return this.getDefaultAgent().resumeSession(sessionId, options);
	}

	async dispose(): Promise<void> {
		const disposeAll = Array.from(this._agents.values()).map((a) =>
			a.dispose().catch(() => undefined),
		);
		await Promise.all(disposeAll);
		this._agents.clear();
		this._order.length = 0;
		this._defaultAgentName = undefined;
	}

	// ---------------------------------------------------------------------------
	// Explicit routing
	// ---------------------------------------------------------------------------

	async createSessionOn(agentName: string, options?: CreateSessionOptions): Promise<OmniSession> {
		return this.agent(agentName).createSession(options);
	}

	// ---------------------------------------------------------------------------
	// Generic fallback
	// ---------------------------------------------------------------------------

	async withFallback<T>(
		fn: (agent: OmniAgent, name: string) => Promise<T>,
		order?: string[],
	): Promise<T> {
		const names = order ?? this._order;
		const shouldFallback = this._config.fallback?.shouldFallback ?? defaultShouldFallback;
		const failures: Array<{ agentName: string; error: Error }> = [];

		for (const name of names) {
			const a = this._agents.get(name);
			if (a === undefined) {
				continue;
			}
			try {
				return await fn(a, name);
			} catch (err) {
				if (err instanceof OmniAgentError && !shouldFallback(err)) {
					// Non-retriable error — rethrow immediately
					throw err;
				}
				failures.push({
					agentName: name,
					error: err instanceof Error ? err : new Error(String(err)),
				});
			}
		}

		throw new AllAgentsFailedError(failures);
	}
}
