/**
 * manager-advanced.ts — withFallback(), dynamic registration, and lifecycle
 *
 * Covers three patterns beyond basic routing:
 *   1. withFallback()  — route any async operation through the fallback machinery
 *   2. Dynamic register/unregister — update the registry at runtime
 *   3. tryAgent() vs agent() — safe vs throwing lookup
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/manager-advanced.ts
 */

import { AgentManager, AgentNotFoundError, OmniAgentError } from "@omni-agent-sdk/core";
import type {
	CreateSessionOptions,
	OmniAgent,
	OmniSession,
	ResumeSessionOptions,
} from "@omni-agent-sdk/core";
import { createProviderAgent, printUsage } from "./_helpers.js";

// ---------------------------------------------------------------------------
// FlakyAgent — throws PROVIDER_ERROR for the first N createSession() calls,
// then delegates to the inner agent.
// ---------------------------------------------------------------------------

class FlakyAgent implements OmniAgent {
	readonly provider: string;
	private _failsLeft: number;
	private readonly _inner: OmniAgent;

	constructor(name: string, inner: OmniAgent, failCount = 1) {
		this.provider = `flaky-${name}`;
		this._inner = inner;
		this._failsLeft = failCount;
	}

	async createSession(options?: CreateSessionOptions): Promise<OmniSession> {
		if (this._failsLeft > 0) {
			this._failsLeft--;
			console.log(`  [flaky] ${this.provider} failing (${this._failsLeft} fails left)`);
			throw new OmniAgentError("Flaky provider failure", {
				provider: this.provider,
				code: "PROVIDER_ERROR",
			});
		}
		return this._inner.createSession(options);
	}

	async resumeSession(sessionId: string, options?: ResumeSessionOptions): Promise<OmniSession> {
		// Resume paths are session-ID-bound; mock failure only applies to createSession.
		return this._inner.resumeSession(sessionId, options);
	}

	async dispose(): Promise<void> {
		return this._inner.dispose();
	}
}

// ---------------------------------------------------------------------------
// Demo 1: withFallback() — route any async operation through fallback logic
//
// Unlike createSession() which only falls back on session creation,
// withFallback() lets you wrap any multi-step async operation so the entire
// sequence (createSession + prompt + dispose) retries on a different agent.
// ---------------------------------------------------------------------------

console.log("=== Demo 1: withFallback() for custom operations ===\n");

const manager = new AgentManager({
	fallback: { enabled: true },
});

manager.register("flaky", new FlakyAgent("primary", await createProviderAgent(), 1));
manager.register("stable", await createProviderAgent());

const result = await manager.withFallback(async (agent, name) => {
	console.log(`  Trying agent: ${name}`);
	const session = await agent.createSession({ cwd: process.cwd() });
	try {
		return await session.prompt({ message: 'Reply with exactly: "withFallback works"' });
	} finally {
		await session.dispose();
	}
});

console.log(`\nResult: ${result.text}`);
printUsage(result.usage);

// ---------------------------------------------------------------------------
// Demo 2: Dynamic register / unregister at runtime
// ---------------------------------------------------------------------------

console.log("\n=== Demo 2: Dynamic registration ===\n");

console.log(`Before: ${manager.agentNames().join(", ")} (size=${manager.size})`);

const tempAgent = await createProviderAgent();
manager.register("temp", tempAgent);
console.log(`After register:   ${manager.agentNames().join(", ")} (size=${manager.size})`);

manager.unregister("temp");
console.log(`After unregister: ${manager.agentNames().join(", ")} (size=${manager.size})`);

// tempAgent is no longer in the manager's registry — dispose it manually
await tempAgent.dispose();

// ---------------------------------------------------------------------------
// Demo 3: tryAgent() vs agent() — safe vs throwing lookup
// ---------------------------------------------------------------------------

console.log("\n=== Demo 3: tryAgent() vs agent() ===\n");

// tryAgent returns undefined — safe for optional / conditional routing
const maybeGemini = manager.tryAgent("gemini");
console.log(`tryAgent("gemini"): ${maybeGemini === undefined ? "undefined (not registered)" : "found"}`);

// agent() throws AgentNotFoundError — use when the agent must be present
try {
	manager.agent("gemini");
} catch (err) {
	if (err instanceof AgentNotFoundError) {
		console.log(`agent("gemini") threw ${err.name}: ${err.message}`);
	}
}

// has() for a simple boolean check
console.log(`has("stable"): ${manager.has("stable")}`);
console.log(`has("gemini"): ${manager.has("gemini")}`);

// ---------------------------------------------------------------------------
// Demo 4: Parallel dispose — all agents torn down in a single await
// ---------------------------------------------------------------------------

console.log("\n=== Demo 4: Parallel dispose ===\n");

console.log(`Disposing ${manager.size} agent(s) in parallel...`);
await manager.dispose();
console.log(`Size after dispose: ${manager.size}`); // 0
