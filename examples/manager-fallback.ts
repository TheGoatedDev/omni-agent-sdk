/**
 * manager-fallback.ts — automatic provider resilience via fallback chains
 *
 * When a provider throws a retriable error (PROVIDER_ERROR or NETWORK by default),
 * AgentManager retries the operation using the next agent in the configured order.
 *
 * This demo uses a MockFailingAgent that throws PROVIDER_ERROR on the first
 * createSession() call to simulate a transient failure, then delegates to the
 * real agent on subsequent calls — no second API key required.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/manager-fallback.ts
 */

import { AgentManager, OmniAgentError } from "@omni-agent-sdk/core";
import type {
	CreateSessionOptions,
	OmniAgent,
	OmniSession,
	ResumeSessionOptions,
} from "@omni-agent-sdk/core";
import { createProviderAgent, printUsage } from "./_helpers.js";

// ---------------------------------------------------------------------------
// MockFailingAgent — throws PROVIDER_ERROR on first createSession(), then
// delegates to the inner agent for all subsequent calls.
// ---------------------------------------------------------------------------

class MockFailingAgent implements OmniAgent {
	readonly provider = "mock-failing";
	private _used = false;
	private readonly _inner: OmniAgent;

	constructor(inner: OmniAgent) {
		this._inner = inner;
	}

	async createSession(options?: CreateSessionOptions): Promise<OmniSession> {
		if (!this._used) {
			this._used = true;
			console.log('  [mock] "primary" createSession() — throwing PROVIDER_ERROR');
			throw new OmniAgentError("Simulated transient provider failure", {
				provider: this.provider,
				code: "PROVIDER_ERROR",
			});
		}
		return this._inner.createSession(options);
	}

	async resumeSession(sessionId: string, options?: ResumeSessionOptions): Promise<OmniSession> {
		return this._inner.resumeSession(sessionId, options);
	}

	async dispose(): Promise<void> {
		return this._inner.dispose();
	}
}

// ---------------------------------------------------------------------------
// Demo 1: Automatic fallback on PROVIDER_ERROR
// ---------------------------------------------------------------------------

console.log("=== Demo 1: Automatic fallback on PROVIDER_ERROR ===\n");

const manager1 = new AgentManager({
	fallback: {
		enabled: true,
		order: ["primary", "backup"],
	},
});

manager1.register("primary", new MockFailingAgent(await createProviderAgent()));
manager1.register("backup", await createProviderAgent());

console.log('Calling manager.createSession() — "primary" will fail, "backup" takes over:\n');

const session1 = await manager1.createSession({ cwd: process.cwd() });
const result1 = await session1.prompt({
	message: 'Reply with exactly: "Fallback succeeded"',
});
console.log(`\nResult: ${result1.text}`);
printUsage(result1.usage);
await session1.dispose();
await manager1.dispose();

// ---------------------------------------------------------------------------
// Demo 2: Custom shouldFallback predicate
//
// By default AgentManager falls back on PROVIDER_ERROR and NETWORK only.
// Pass a custom predicate to restrict (or expand) which error codes trigger
// fallback. Here we explicitly enumerate the two default codes for clarity.
// ---------------------------------------------------------------------------

console.log("\n=== Demo 2: Custom shouldFallback predicate ===\n");

const manager2 = new AgentManager({
	fallback: {
		enabled: true,
		order: ["primary", "backup"],
		shouldFallback: (err) => err.code === "PROVIDER_ERROR" || err.code === "NETWORK",
	},
});

manager2.register("primary", new MockFailingAgent(await createProviderAgent()));
manager2.register("backup", await createProviderAgent());

const session2 = await manager2.createSession({ cwd: process.cwd() });
const result2 = await session2.prompt({
	message: 'Reply with exactly: "Custom predicate works"',
});
console.log(`Result: ${result2.text}`);
printUsage(result2.usage);
console.log("\nNote: BUDGET_EXCEEDED, TURN_LIMIT, etc. propagate immediately — no fallback.");
await session2.dispose();
await manager2.dispose();
