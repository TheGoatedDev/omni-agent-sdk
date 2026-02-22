import { execSync } from "node:child_process";
import { AgentManager, OmniAgentError } from "@omni-agent-sdk/core";
import { makeFailingMockAgent, makeMockAgent } from "../conformance/helpers.js";
import { defineConformanceSuite } from "../conformance/suite.js";

// ---------------------------------------------------------------------------
// CLI binary detection
// ---------------------------------------------------------------------------

function isBinaryAvailable(name: string): boolean {
	try {
		execSync(`which ${name}`, { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

// When running inside a Claude Code session (CLAUDECODE env var is set),
// launching a nested claude process will always fail. Skip Claude tests in that case.
const claudeAvailable = isBinaryAvailable("claude") && !process.env.CLAUDECODE;
const codexAvailable = isBinaryAvailable("codex");

// ---------------------------------------------------------------------------
// Conformance suites — one per provider
// ---------------------------------------------------------------------------

defineConformanceSuite({
	name: "Claude (via claude CLI)",
	canRun: () => claudeAvailable,
	createAgent: async () => {
		const { createAgent } = await import("@omni-agent-sdk/provider-claude");
		return createAgent({});
	},
	testPrompt: "Reply with exactly: HELLO",
	timeout: 60_000,
});

defineConformanceSuite({
	name: "Codex (via codex CLI)",
	canRun: () => codexAvailable,
	createAgent: async () => {
		const { createAgent } = await import("@omni-agent-sdk/provider-codex");
		// skipGitRepoCheck allows Codex to run outside a git repository,
		// which is the case in CI environments and test directories.
		return createAgent({
			providerOptions: { skipGitRepoCheck: true },
		});
	},
	testPrompt: "Reply with exactly: HELLO",
	timeout: 60_000,
});

// ---------------------------------------------------------------------------
// AgentManager cross-provider integration tests
// ---------------------------------------------------------------------------

describe.skipIf(!claudeAvailable && !codexAvailable)("AgentManager cross-provider", () => {
	it("iterates registered providers", async () => {
		const manager = new AgentManager();

		if (claudeAvailable) {
			const { createAgent } = await import("@omni-agent-sdk/provider-claude");
			manager.register("claude", createAgent({}));
		}

		if (codexAvailable) {
			const { createAgent } = await import("@omni-agent-sdk/provider-codex");
			manager.register("codex", createAgent({}));
		}

		const registeredNames = manager.agentNames();
		expect(registeredNames.length).toBeGreaterThanOrEqual(1);

		// Verify iteration via Symbol.iterator yields all registered entries
		let count = 0;
		for (const [name, agent] of manager) {
			expect(typeof name).toBe("string");
			expect(agent.provider).toBeTruthy();
			count++;
		}
		expect(count).toBe(registeredNames.length);

		await manager.dispose();
	});

	it("withFallback tries next provider on PROVIDER_ERROR", async () => {
		const failingError = new OmniAgentError("Simulated provider failure", {
			provider: "mock-failing",
			code: "PROVIDER_ERROR",
		});

		const failingAgent = makeFailingMockAgent("mock-failing", failingError);
		const workingAgent = makeMockAgent("mock-working");

		const manager = new AgentManager({
			fallback: { enabled: true, order: ["failing", "working"] },
		});

		manager.register("failing", failingAgent);
		manager.register("working", workingAgent);

		// withFallback should skip the failing agent and succeed with the working one
		const session = await manager.withFallback((agent) => agent.createSession());
		expect(session.id).toBeTruthy();

		await manager.dispose();
	});
});
