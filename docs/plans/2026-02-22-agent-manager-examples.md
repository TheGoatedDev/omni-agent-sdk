# AgentManager Examples Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three example scripts (`manager-basics.ts`, `manager-fallback.ts`, `manager-advanced.ts`) demonstrating the AgentManager API — registry/routing, automatic fallback chains, and advanced lifecycle patterns.

**Architecture:** Each file is a standalone runnable script (`npx tsx examples/<file>.ts`) following the existing example conventions — a JSDoc header block, imports from `@omni-agent-sdk/core` and `./_helpers.js`, and structured `console.log` sections. The fallback and advanced examples define a local `MockFailingAgent`/`FlakyAgent` wrapper class that implements `OmniAgent` and throws `OmniAgentError` on first `createSession()` to simulate a transient failure — no second API key required.

**Tech Stack:** TypeScript (strict), `@omni-agent-sdk/core` (AgentManager, OmniAgentError, AgentNotFoundError), `./_helpers.js` (createProviderAgent, printUsage), `npx tsx` for execution.

---

### Task 1: `manager-basics.ts` — registry operations and explicit routing

**Files:**
- Create: `examples/manager-basics.ts`

**Step 1: Create the file**

```typescript
/**
 * manager-basics.ts — registry operations and explicit routing
 *
 * AgentManager acts as a named registry of OmniAgent instances.
 * You can route sessions to a specific named agent, rely on the auto-default,
 * change the default at runtime, and iterate over all registered agents.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/manager-basics.ts
 */

import { AgentManager } from "@omni-agent-sdk/core";
import { createProviderAgent, printUsage } from "./_helpers.js";

// ---------------------------------------------------------------------------
// Register two independent agent instances under different names.
// First registered becomes the default automatically.
// ---------------------------------------------------------------------------

const agentA = await createProviderAgent();
const agentB = await createProviderAgent();

const manager = new AgentManager();
manager.register("agent-a", agentA);
manager.register("agent-b", agentB);

console.log(`Registered: ${manager.agentNames().join(", ")}`);
console.log(`Default:    ${manager.defaultAgentName}`);
console.log("─".repeat(60));

// ---------------------------------------------------------------------------
// Explicit routing — createSessionOn() sends to a specific named agent
// ---------------------------------------------------------------------------

console.log("\n=== Explicit routing to agent-a ===\n");

const sessionA = await manager.createSessionOn("agent-a", { cwd: process.cwd() });
const resultA = await sessionA.prompt({
	message: 'Reply with exactly: "Hello from agent-a"',
});
console.log(resultA.text);
printUsage(resultA.usage);
await sessionA.dispose();

// ---------------------------------------------------------------------------
// Default routing — createSession() delegates to the current default (agent-a)
// ---------------------------------------------------------------------------

console.log("\n=== Default routing (agent-a) ===\n");

const session1 = await manager.createSession({ cwd: process.cwd() });
const result1 = await session1.prompt({
	message: 'Reply with exactly: "Default agent answered"',
});
console.log(result1.text);
await session1.dispose();

// ---------------------------------------------------------------------------
// Change default at runtime and route again
// ---------------------------------------------------------------------------

manager.defaultAgentName = "agent-b";
console.log(`\nChanged default to: ${manager.defaultAgentName}`);

const session2 = await manager.createSession({ cwd: process.cwd() });
const result2 = await session2.prompt({
	message: 'Reply with exactly: "Now routed to agent-b"',
});
console.log(result2.text);
await session2.dispose();

// ---------------------------------------------------------------------------
// Iterate over all registered agents
// ---------------------------------------------------------------------------

console.log("\n=== All registered agents ===\n");

for (const [name, agent] of manager) {
	console.log(`  ${name}: provider=${agent.provider}`);
}

// dispose() tears down all agents in parallel
await manager.dispose();
console.log(`\nSize after dispose: ${manager.size}`); // 0
```

**Step 2: Type-check**

```bash
pnpm --filter @omni-agent-sdk/examples check
```

Expected: no errors.

**Step 3: Smoke-run (requires API key)**

```bash
ANTHROPIC_API_KEY=sk-... npx tsx examples/manager-basics.ts
```

Expected: three sections print, final line shows `Size after dispose: 0`.

**Step 4: Commit**

```bash
git add examples/manager-basics.ts
git commit -m "feat(examples): add manager-basics.ts — registry and explicit routing"
```

---

### Task 2: `manager-fallback.ts` — automatic fallback chain

**Files:**
- Create: `examples/manager-fallback.ts`

**Step 1: Create the file**

```typescript
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
console.log("\nNote: BUDGET_EXCEEDED, TURN_LIMIT, etc. propagate immediately — no fallback.");
await session2.dispose();
await manager2.dispose();
```

**Step 2: Type-check**

```bash
pnpm --filter @omni-agent-sdk/examples check
```

Expected: no errors.

**Step 3: Smoke-run**

```bash
ANTHROPIC_API_KEY=sk-... npx tsx examples/manager-fallback.ts
```

Expected: `[mock] "primary" createSession() — throwing PROVIDER_ERROR` appears, then the session succeeds via backup. Demo 2 passes too.

**Step 4: Commit**

```bash
git add examples/manager-fallback.ts
git commit -m "feat(examples): add manager-fallback.ts — automatic fallback chain"
```

---

### Task 3: `manager-advanced.ts` — withFallback(), dynamic lifecycle, lookup patterns

**Files:**
- Create: `examples/manager-advanced.ts`

**Step 1: Create the file**

```typescript
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

import { AgentManager, OmniAgentError } from "@omni-agent-sdk/core";
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
	if (err instanceof OmniAgentError) {
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
```

**Step 2: Type-check**

```bash
pnpm --filter @omni-agent-sdk/examples check
```

Expected: no errors.

**Step 3: Smoke-run**

```bash
ANTHROPIC_API_KEY=sk-... npx tsx examples/manager-advanced.ts
```

Expected: all four demo sections run, `Size after dispose: 0` at the end.

**Step 4: Commit**

```bash
git add examples/manager-advanced.ts
git commit -m "feat(examples): add manager-advanced.ts — withFallback, dynamic lifecycle, lookup"
```

---

### Task 4: Final type-check across all packages

**Step 1: Full monorepo type-check**

```bash
pnpm check
```

Expected: all packages pass with no errors.

**Step 2: Commit design doc**

```bash
git add docs/plans/2026-02-22-agent-manager-examples-design.md docs/plans/2026-02-22-agent-manager-examples.md
git commit -m "docs: add AgentManager examples design doc and implementation plan"
```
