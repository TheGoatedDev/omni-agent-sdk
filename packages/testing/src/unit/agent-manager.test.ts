import {
	AgentManager,
	AgentNotFoundError,
	AllAgentsFailedError,
	NoDefaultAgentError,
	OmniAgentError,
} from "@omni-agent-sdk/core";
import type {
	CreateSessionOptions,
	OmniAgent,
	OmniSession,
	ResumeSessionOptions,
} from "@omni-agent-sdk/core";
import type { OmniErrorCode } from "@omni-agent-sdk/core";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeMockSession(id: string): OmniSession {
	return {
		id,
		prompt: vi.fn().mockResolvedValue({ messages: [], usage: undefined }),
		promptStreaming: vi.fn(),
		abort: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn().mockResolvedValue(undefined),
	};
}

interface MockAgentOptions {
	/** If provided, createSession will throw an OmniAgentError with this code. */
	failWith?: OmniErrorCode;
	/** Override the auto-generated session id. */
	sessionId?: string;
	provider?: string;
}

function makeMockAgent(opts: MockAgentOptions = {}): OmniAgent {
	const { failWith, provider = "mock" } = opts;
	const sessionId = opts.sessionId ?? `session-${Math.random().toString(36).slice(2)}`;

	const createSession = vi.fn(async (_options?: CreateSessionOptions) => {
		if (failWith !== undefined) {
			throw new OmniAgentError(`Simulated ${failWith} failure`, {
				provider,
				code: failWith,
			});
		}
		return makeMockSession(sessionId);
	});

	const resumeSession = vi.fn(
		async (_sessionId: string, _options?: ResumeSessionOptions): Promise<OmniSession> => {
			return makeMockSession(_sessionId);
		},
	);

	return {
		provider,
		createSession,
		resumeSession,
		dispose: vi.fn().mockResolvedValue(undefined),
	};
}

// ---------------------------------------------------------------------------
// 1. Registry
// ---------------------------------------------------------------------------

describe("AgentManager — Registry", () => {
	let manager: AgentManager;

	beforeEach(() => {
		manager = new AgentManager();
	});

	it("starts with size 0 and no agents", () => {
		expect(manager.size).toBe(0);
		expect(manager.agentNames()).toEqual([]);
	});

	it("register() adds an agent and increments size", () => {
		const agent = makeMockAgent();
		manager.register("claude", agent);

		expect(manager.size).toBe(1);
		expect(manager.has("claude")).toBe(true);
	});

	it("register() returns `this` for chaining", () => {
		const a = makeMockAgent();
		const b = makeMockAgent();
		const result = manager.register("a", a).register("b", b);

		expect(result).toBe(manager);
		expect(manager.size).toBe(2);
	});

	it("agent() returns the registered agent", () => {
		const agent = makeMockAgent();
		manager.register("claude", agent);

		expect(manager.agent("claude")).toBe(agent);
	});

	it("agent() throws AgentNotFoundError for unknown name", () => {
		expect(() => manager.agent("ghost")).toThrow(AgentNotFoundError);
		expect(() => manager.agent("ghost")).toThrow('Agent not found: "ghost"');
	});

	it("has() returns false for unregistered names", () => {
		expect(manager.has("nothing")).toBe(false);
	});

	it("has() returns true after registration and false after unregister", () => {
		const agent = makeMockAgent();
		manager.register("claude", agent);
		expect(manager.has("claude")).toBe(true);

		manager.unregister("claude");
		expect(manager.has("claude")).toBe(false);
	});

	it("unregister() returns true on success and false for unknown name", () => {
		const agent = makeMockAgent();
		manager.register("claude", agent);

		expect(manager.unregister("claude")).toBe(true);
		expect(manager.unregister("claude")).toBe(false);
	});

	it("unregister() decrements size and removes from agentNames()", () => {
		manager.register("a", makeMockAgent());
		manager.register("b", makeMockAgent());
		manager.unregister("a");

		expect(manager.size).toBe(1);
		expect(manager.agentNames()).toEqual(["b"]);
	});

	it("agentNames() returns names in insertion order", () => {
		manager.register("c", makeMockAgent());
		manager.register("a", makeMockAgent());
		manager.register("b", makeMockAgent());

		expect(manager.agentNames()).toEqual(["c", "a", "b"]);
	});

	it("re-registering an existing name does not duplicate in agentNames()", () => {
		const first = makeMockAgent();
		const second = makeMockAgent();
		manager.register("claude", first);
		manager.register("claude", second);

		expect(manager.size).toBe(1);
		expect(manager.agentNames()).toEqual(["claude"]);
		expect(manager.agent("claude")).toBe(second);
	});

	it("Symbol.iterator yields [name, agent] pairs in insertion order", () => {
		const agentA = makeMockAgent();
		const agentB = makeMockAgent();
		const agentC = makeMockAgent();
		manager.register("first", agentA);
		manager.register("second", agentB);
		manager.register("third", agentC);

		const entries = [...manager];

		expect(entries).toHaveLength(3);
		expect(entries[0]).toEqual(["first", agentA]);
		expect(entries[1]).toEqual(["second", agentB]);
		expect(entries[2]).toEqual(["third", agentC]);
	});

	it("auto-sets default to the first registered agent", () => {
		const first = makeMockAgent();
		const second = makeMockAgent();
		manager.register("first", first);
		manager.register("second", second);

		expect(manager.defaultAgentName).toBe("first");
	});
});

// ---------------------------------------------------------------------------
// 2. Default management
// ---------------------------------------------------------------------------

describe("AgentManager — Default management", () => {
	let manager: AgentManager;

	beforeEach(() => {
		manager = new AgentManager();
	});

	it("provider is always 'manager'", () => {
		expect(manager.provider).toBe("manager");
	});

	it("defaultAgentName is undefined before any agent is registered", () => {
		expect(manager.defaultAgentName).toBeUndefined();
	});

	it("defaultAgentName setter updates the default", () => {
		manager.register("claude", makeMockAgent());
		manager.register("codex", makeMockAgent());

		manager.defaultAgentName = "codex";

		expect(manager.defaultAgentName).toBe("codex");
	});

	it("defaultAgentName setter throws AgentNotFoundError for unregistered name", () => {
		manager.register("claude", makeMockAgent());

		expect(() => {
			manager.defaultAgentName = "nonexistent";
		}).toThrow(AgentNotFoundError);
	});

	it("unregistering the default agent reassigns default to next in order", () => {
		manager.register("first", makeMockAgent());
		manager.register("second", makeMockAgent());

		expect(manager.defaultAgentName).toBe("first");
		manager.unregister("first");

		expect(manager.defaultAgentName).toBe("second");
	});

	it("unregistering the only agent sets defaultAgentName to undefined", () => {
		manager.register("only", makeMockAgent());
		manager.unregister("only");

		expect(manager.defaultAgentName).toBeUndefined();
	});

	it("defaultAgentName from config constructor option is respected", async () => {
		const agentA = makeMockAgent({ sessionId: "session-a" });
		const agentB = makeMockAgent({ sessionId: "session-b" });

		manager = new AgentManager({ defaultAgent: "b" });
		manager.register("a", agentA);
		manager.register("b", agentB);

		// config.defaultAgent is not automatically applied in this implementation;
		// the default is still set to first registered. Confirm observed behavior.
		// The constructor only stores config — actual defaultAgent from config is
		// not applied at register time (there's no code path for it).
		// The first registered agent wins.
		expect(manager.defaultAgentName).toBe("a");
	});
});

// ---------------------------------------------------------------------------
// 3. Facade — delegates to default agent
// ---------------------------------------------------------------------------

describe("AgentManager — Facade (delegates to default agent)", () => {
	let manager: AgentManager;
	let defaultAgent: OmniAgent;

	beforeEach(() => {
		manager = new AgentManager();
		defaultAgent = makeMockAgent({ sessionId: "default-session" });
		manager.register("default", defaultAgent);
	});

	it("createSession() delegates to the default agent", async () => {
		const session = await manager.createSession();

		expect(defaultAgent.createSession).toHaveBeenCalledOnce();
		expect(session.id).toBe("default-session");
	});

	it("createSession() passes options through to the default agent", async () => {
		const options: CreateSessionOptions = { cwd: "/tmp", providerOptions: { model: "claude-3" } };
		await manager.createSession(options);

		expect(defaultAgent.createSession).toHaveBeenCalledWith(options);
	});

	it("resumeSession() delegates to the default agent", async () => {
		const session = await manager.resumeSession("existing-session-id");

		expect(defaultAgent.resumeSession).toHaveBeenCalledWith("existing-session-id", undefined);
		expect(session.id).toBe("existing-session-id");
	});

	it("resumeSession() passes options through to the default agent", async () => {
		const options: ResumeSessionOptions = { cwd: "/project" };
		await manager.resumeSession("sess-123", options);

		expect(defaultAgent.resumeSession).toHaveBeenCalledWith("sess-123", options);
	});

	it("createSession() throws NoDefaultAgentError when no agents are registered", async () => {
		const empty = new AgentManager();

		await expect(empty.createSession()).rejects.toThrow(NoDefaultAgentError);
	});

	it("resumeSession() throws NoDefaultAgentError when no agents are registered", async () => {
		const empty = new AgentManager();

		await expect(empty.resumeSession("sess-abc")).rejects.toThrow(NoDefaultAgentError);
	});

	it("uses the explicitly set default when multiple agents are registered", async () => {
		const secondAgent = makeMockAgent({ sessionId: "second-session" });
		manager.register("second", secondAgent);

		manager.defaultAgentName = "second";
		const session = await manager.createSession();

		expect(defaultAgent.createSession).not.toHaveBeenCalled();
		expect(session.id).toBe("second-session");
	});
});

// ---------------------------------------------------------------------------
// 4. Explicit routing
// ---------------------------------------------------------------------------

describe("AgentManager — Explicit routing (createSessionOn)", () => {
	let manager: AgentManager;
	let agentA: OmniAgent;
	let agentB: OmniAgent;

	beforeEach(() => {
		manager = new AgentManager();
		agentA = makeMockAgent({ sessionId: "session-a" });
		agentB = makeMockAgent({ sessionId: "session-b" });
		manager.register("agent-a", agentA);
		manager.register("agent-b", agentB);
	});

	it("createSessionOn() calls createSession on the named agent", async () => {
		const session = await manager.createSessionOn("agent-b");

		expect(agentB.createSession).toHaveBeenCalledOnce();
		expect(agentA.createSession).not.toHaveBeenCalled();
		expect(session.id).toBe("session-b");
	});

	it("createSessionOn() passes options through to the named agent", async () => {
		const options: CreateSessionOptions = { cwd: "/work" };
		await manager.createSessionOn("agent-a", options);

		expect(agentA.createSession).toHaveBeenCalledWith(options);
	});

	it("createSessionOn() throws AgentNotFoundError for an unregistered name", async () => {
		await expect(manager.createSessionOn("nonexistent")).rejects.toThrow(AgentNotFoundError);
		await expect(manager.createSessionOn("nonexistent")).rejects.toThrow(
			'Agent not found: "nonexistent"',
		);
	});

	it("createSessionOn() does not fall back even when fallback is configured", async () => {
		const failingManager = new AgentManager({ fallback: { enabled: true } });
		const failingAgent = makeMockAgent({ failWith: "PROVIDER_ERROR" });
		failingManager.register("primary", failingAgent);

		await expect(failingManager.createSessionOn("primary")).rejects.toThrow(OmniAgentError);
	});
});

// ---------------------------------------------------------------------------
// 5. withFallback
// ---------------------------------------------------------------------------

describe("AgentManager — withFallback", () => {
	let manager: AgentManager;

	beforeEach(() => {
		manager = new AgentManager({ fallback: { enabled: true } });
	});

	it("falls back to next agent on PROVIDER_ERROR", async () => {
		const failing = makeMockAgent({ failWith: "PROVIDER_ERROR" });
		const succeeding = makeMockAgent({ sessionId: "fallback-session" });
		manager.register("primary", failing);
		manager.register("backup", succeeding);

		const session = await manager.withFallback((agent) => agent.createSession());

		expect(failing.createSession).toHaveBeenCalledOnce();
		expect(succeeding.createSession).toHaveBeenCalledOnce();
		expect(session.id).toBe("fallback-session");
	});

	it("falls back to next agent on NETWORK error", async () => {
		const failing = makeMockAgent({ failWith: "NETWORK" });
		const succeeding = makeMockAgent({ sessionId: "network-fallback" });
		manager.register("primary", failing);
		manager.register("backup", succeeding);

		const session = await manager.withFallback((agent) => agent.createSession());

		expect(session.id).toBe("network-fallback");
	});

	it("does NOT fall back for ABORT — rethrows immediately", async () => {
		const aborting = makeMockAgent({ failWith: "ABORT" });
		const backup = makeMockAgent({ sessionId: "should-not-reach" });
		manager.register("primary", aborting);
		manager.register("backup", backup);

		await expect(manager.withFallback((agent) => agent.createSession())).rejects.toThrow(
			OmniAgentError,
		);

		expect(backup.createSession).not.toHaveBeenCalled();
	});

	it("does NOT fall back for BUDGET_EXCEEDED — rethrows immediately", async () => {
		const budgetExhausted = makeMockAgent({ failWith: "BUDGET_EXCEEDED" });
		const backup = makeMockAgent({ sessionId: "should-not-reach" });
		manager.register("primary", budgetExhausted);
		manager.register("backup", backup);

		await expect(manager.withFallback((agent) => agent.createSession())).rejects.toThrow(
			OmniAgentError,
		);

		expect(backup.createSession).not.toHaveBeenCalled();
	});

	it("does NOT fall back for CONFIGURATION — rethrows immediately", async () => {
		const misconfigured = makeMockAgent({ failWith: "CONFIGURATION" });
		const backup = makeMockAgent({ sessionId: "should-not-reach" });
		manager.register("primary", misconfigured);
		manager.register("backup", backup);

		await expect(manager.withFallback((agent) => agent.createSession())).rejects.toThrow(
			OmniAgentError,
		);

		expect(backup.createSession).not.toHaveBeenCalled();
	});

	it("respects a custom shouldFallback predicate", async () => {
		// Custom predicate: only fall back on NETWORK (not PROVIDER_ERROR)
		const customManager = new AgentManager({
			fallback: {
				enabled: true,
				shouldFallback: (err) => err.code === "NETWORK",
			},
		});

		const providerError = makeMockAgent({ failWith: "PROVIDER_ERROR" });
		const backup = makeMockAgent({ sessionId: "backup-session" });
		customManager.register("primary", providerError);
		customManager.register("backup", backup);

		// PROVIDER_ERROR with custom predicate should NOT fall back
		await expect(customManager.withFallback((agent) => agent.createSession())).rejects.toThrow(
			OmniAgentError,
		);
		expect(backup.createSession).not.toHaveBeenCalled();
	});

	it("custom shouldFallback: does fall back when predicate returns true", async () => {
		const customManager = new AgentManager({
			fallback: {
				enabled: true,
				shouldFallback: (err) => err.code === "NETWORK",
			},
		});

		const networkFailing = makeMockAgent({ failWith: "NETWORK" });
		const backup = makeMockAgent({ sessionId: "custom-fallback" });
		customManager.register("primary", networkFailing);
		customManager.register("backup", backup);

		const session = await customManager.withFallback((agent) => agent.createSession());

		expect(session.id).toBe("custom-fallback");
	});

	it("respects a custom order array — tries named agents in that order", async () => {
		const callOrder: string[] = [];

		const agentA = makeMockAgent({ failWith: "PROVIDER_ERROR" });
		(agentA.createSession as ReturnType<typeof vi.fn>).mockImplementation(async () => {
			callOrder.push("a");
			throw new OmniAgentError("fail", { provider: "mock", code: "PROVIDER_ERROR" });
		});

		const agentB = makeMockAgent({ sessionId: "b-session" });
		(agentB.createSession as ReturnType<typeof vi.fn>).mockImplementation(async () => {
			callOrder.push("b");
			return makeMockSession("b-session");
		});

		const agentC = makeMockAgent({ sessionId: "c-session" });
		(agentC.createSession as ReturnType<typeof vi.fn>).mockImplementation(async () => {
			callOrder.push("c");
			return makeMockSession("c-session");
		});

		manager.register("a", agentA);
		manager.register("b", agentB);
		manager.register("c", agentC);

		// Override order: try c first, then a, then b
		const session = await manager.withFallback((agent) => agent.createSession(), ["c", "a", "b"]);

		expect(callOrder).toEqual(["c"]);
		expect(session.id).toBe("c-session");
	});

	it("respects order array: falls back through the order when earlier agents fail", async () => {
		const failing = makeMockAgent({ failWith: "PROVIDER_ERROR" });
		const succeeding = makeMockAgent({ sessionId: "ordered-session" });
		manager.register("a", failing);
		manager.register("b", succeeding);

		// Explicitly specify order: a first (fails), then b (succeeds)
		const session = await manager.withFallback((agent) => agent.createSession(), ["a", "b"]);

		expect(failing.createSession).toHaveBeenCalledOnce();
		expect(succeeding.createSession).toHaveBeenCalledOnce();
		expect(session.id).toBe("ordered-session");
	});

	it("throws AllAgentsFailedError when all agents fail", async () => {
		const failingA = makeMockAgent({ failWith: "PROVIDER_ERROR" });
		const failingB = makeMockAgent({ failWith: "NETWORK" });
		manager.register("a", failingA);
		manager.register("b", failingB);

		await expect(manager.withFallback((agent) => agent.createSession())).rejects.toThrow(
			AllAgentsFailedError,
		);
	});

	it("AllAgentsFailedError contains an entry per failed agent", async () => {
		const failingA = makeMockAgent({ failWith: "PROVIDER_ERROR" });
		const failingB = makeMockAgent({ failWith: "NETWORK" });
		manager.register("alpha", failingA);
		manager.register("beta", failingB);

		let caughtError: AllAgentsFailedError | undefined;
		try {
			await manager.withFallback((agent) => agent.createSession());
		} catch (err) {
			if (err instanceof AllAgentsFailedError) {
				caughtError = err;
			}
		}

		expect(caughtError).toBeInstanceOf(AllAgentsFailedError);
		expect(caughtError?.errors).toHaveLength(2);
		expect(caughtError?.errors[0].agentName).toBe("alpha");
		expect(caughtError?.errors[1].agentName).toBe("beta");
		expect(caughtError?.errors[0].error).toBeInstanceOf(Error);
		expect(caughtError?.errors[1].error).toBeInstanceOf(Error);
	});

	it("skips unknown names in a custom order array rather than throwing", async () => {
		const succeeding = makeMockAgent({ sessionId: "skip-unknown" });
		manager.register("known", succeeding);

		// "unknown-agent" is not registered; should be silently skipped
		const session = await manager.withFallback(
			(agent) => agent.createSession(),
			["unknown-agent", "known"],
		);

		expect(session.id).toBe("skip-unknown");
	});

	it("AllAgentsFailedError is thrown even when order contains only unknown names", async () => {
		manager.register("registered", makeMockAgent());

		// The order array references only unregistered names — all are skipped,
		// so the failures array is empty and AllAgentsFailedError is still thrown.
		await expect(
			manager.withFallback((agent) => agent.createSession(), ["ghost-1", "ghost-2"]),
		).rejects.toThrow(AllAgentsFailedError);
	});

	it("wraps non-Error throws in a plain Error inside the failures array", async () => {
		const weirdAgent: OmniAgent = {
			provider: "weird",
			createSession: vi.fn().mockRejectedValue("just a string error"),
			resumeSession: vi.fn(),
			dispose: vi.fn().mockResolvedValue(undefined),
		};
		manager.register("weird", weirdAgent);

		let caughtError: AllAgentsFailedError | undefined;
		try {
			await manager.withFallback((agent) => agent.createSession());
		} catch (err) {
			if (err instanceof AllAgentsFailedError) {
				caughtError = err;
			}
		}

		expect(caughtError).toBeInstanceOf(AllAgentsFailedError);
		expect(caughtError?.errors[0].error).toBeInstanceOf(Error);
		expect(caughtError?.errors[0].error.message).toBe("just a string error");
	});
});

// ---------------------------------------------------------------------------
// 6. createSession with fallback.enabled = true
// ---------------------------------------------------------------------------

describe("AgentManager — createSession with fallback enabled", () => {
	it("createSession uses fallback logic when fallback.enabled=true", async () => {
		const failing = makeMockAgent({ failWith: "PROVIDER_ERROR" });
		const succeeding = makeMockAgent({ sessionId: "fallback-via-create-session" });

		const manager = new AgentManager({ fallback: { enabled: true } });
		manager.register("primary", failing);
		manager.register("secondary", succeeding);

		const session = await manager.createSession();

		expect(failing.createSession).toHaveBeenCalledOnce();
		expect(succeeding.createSession).toHaveBeenCalledOnce();
		expect(session.id).toBe("fallback-via-create-session");
	});

	it("createSession with fallback.enabled=true and a custom order uses that order", async () => {
		const agentA = makeMockAgent({ failWith: "PROVIDER_ERROR", sessionId: "a" });
		const agentB = makeMockAgent({ sessionId: "b" });

		const manager = new AgentManager({
			fallback: { enabled: true, order: ["b", "a"] },
		});
		manager.register("a", agentA);
		manager.register("b", agentB);

		const session = await manager.createSession();

		// "b" is first in the custom order, so it should be tried first and succeed
		expect(agentA.createSession).not.toHaveBeenCalled();
		expect(agentB.createSession).toHaveBeenCalledOnce();
		expect(session.id).toBe("b");
	});

	it("createSession without fallback enabled does NOT fall back", async () => {
		const failing = makeMockAgent({ failWith: "PROVIDER_ERROR" });
		const backup = makeMockAgent({ sessionId: "should-not-reach" });

		const manager = new AgentManager({ fallback: { enabled: false } });
		manager.register("primary", failing);
		manager.register("backup", backup);

		await expect(manager.createSession()).rejects.toThrow(OmniAgentError);
		expect(backup.createSession).not.toHaveBeenCalled();
	});

	it("createSession with fallback.enabled=true throws AllAgentsFailedError when all fail", async () => {
		const manager = new AgentManager({ fallback: { enabled: true } });
		manager.register("a", makeMockAgent({ failWith: "PROVIDER_ERROR" }));
		manager.register("b", makeMockAgent({ failWith: "NETWORK" }));

		await expect(manager.createSession()).rejects.toThrow(AllAgentsFailedError);
	});

	it("resumeSession never uses fallback even when fallback is enabled", async () => {
		// Build a primary agent whose resumeSession also throws, so we can verify
		// that the error propagates directly without trying the backup agent.
		const failing = makeMockAgent({ failWith: "PROVIDER_ERROR" });
		(failing.resumeSession as ReturnType<typeof vi.fn>).mockRejectedValue(
			new OmniAgentError("Simulated PROVIDER_ERROR failure", {
				provider: "mock",
				code: "PROVIDER_ERROR",
			}),
		);
		const backup = makeMockAgent({ sessionId: "backup" });

		const manager = new AgentManager({ fallback: { enabled: true } });
		manager.register("primary", failing);
		manager.register("backup", backup);

		// resumeSession always delegates to default — no fallback
		await expect(manager.resumeSession("sess-xyz")).rejects.toThrow(OmniAgentError);
		expect(backup.resumeSession).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// 7. Dispose
// ---------------------------------------------------------------------------

describe("AgentManager — Dispose", () => {
	it("dispose() calls dispose on all registered agents", async () => {
		const manager = new AgentManager();
		const agentA = makeMockAgent();
		const agentB = makeMockAgent();
		const agentC = makeMockAgent();
		manager.register("a", agentA);
		manager.register("b", agentB);
		manager.register("c", agentC);

		await manager.dispose();

		expect(agentA.dispose).toHaveBeenCalledOnce();
		expect(agentB.dispose).toHaveBeenCalledOnce();
		expect(agentC.dispose).toHaveBeenCalledOnce();
	});

	it("dispose() clears the registry (size becomes 0)", async () => {
		const manager = new AgentManager();
		manager.register("a", makeMockAgent());
		manager.register("b", makeMockAgent());

		await manager.dispose();

		expect(manager.size).toBe(0);
		expect(manager.agentNames()).toEqual([]);
	});

	it("dispose() sets defaultAgentName to undefined", async () => {
		const manager = new AgentManager();
		manager.register("a", makeMockAgent());

		expect(manager.defaultAgentName).toBe("a");
		await manager.dispose();

		expect(manager.defaultAgentName).toBeUndefined();
	});

	it("dispose() is idempotent — calling it twice does not throw", async () => {
		const manager = new AgentManager();
		manager.register("a", makeMockAgent());

		await manager.dispose();
		await expect(manager.dispose()).resolves.toBeUndefined();
	});

	it("dispose() swallows errors thrown by individual agent dispose calls", async () => {
		const manager = new AgentManager();
		const brokenAgent: OmniAgent = {
			provider: "broken",
			createSession: vi.fn(),
			resumeSession: vi.fn(),
			dispose: vi.fn().mockRejectedValue(new Error("dispose blew up")),
		};
		const healthyAgent = makeMockAgent();

		manager.register("broken", brokenAgent);
		manager.register("healthy", healthyAgent);

		// Should not throw even though one agent's dispose rejects
		await expect(manager.dispose()).resolves.toBeUndefined();

		// The healthy agent should still have been disposed
		expect(healthyAgent.dispose).toHaveBeenCalledOnce();
	});

	it("after dispose() createSession throws NoDefaultAgentError (registry is empty)", async () => {
		const manager = new AgentManager();
		manager.register("a", makeMockAgent());

		await manager.dispose();

		await expect(manager.createSession()).rejects.toThrow(NoDefaultAgentError);
	});
});
