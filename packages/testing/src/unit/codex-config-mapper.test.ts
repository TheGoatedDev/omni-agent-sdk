import type { OmniAgentConfig } from "@omni-agent-sdk/core";
import { buildCodexOptions } from "../../../provider-codex/src/mappers/config.js";
import type { CodexAgentConfig } from "../../../provider-codex/src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(shape: Partial<OmniAgentConfig> & Record<string, unknown>): CodexAgentConfig {
	return shape as unknown as CodexAgentConfig;
}

// ---------------------------------------------------------------------------
// Minimal / empty config
// ---------------------------------------------------------------------------

describe("buildCodexOptions — empty config", () => {
	it("returns an empty object when no config fields are provided", () => {
		const result = buildCodexOptions(makeConfig({}));

		expect(result).toEqual({});
		expect(result.env).toBeUndefined();
		expect(result.config).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Permission policy mapping
// ---------------------------------------------------------------------------

describe("buildCodexOptions — permissions mapping", () => {
	it("maps 'auto-approve' to approvalPolicy 'never'", () => {
		const result = buildCodexOptions(makeConfig({ permissions: "auto-approve" }));

		expect(result.config).toMatchObject({ approvalPolicy: "never" });
	});

	it("maps 'approve-edits' to approvalPolicy 'on-request'", () => {
		const result = buildCodexOptions(makeConfig({ permissions: "approve-edits" }));

		expect(result.config).toMatchObject({ approvalPolicy: "on-request" });
	});

	it("maps 'ask' to approvalPolicy 'untrusted'", () => {
		const result = buildCodexOptions(makeConfig({ permissions: "ask" }));

		expect(result.config).toMatchObject({ approvalPolicy: "untrusted" });
	});

	it("maps 'plan-only' to approvalPolicy 'read-only'", () => {
		const result = buildCodexOptions(makeConfig({ permissions: "plan-only" }));

		expect(result.config).toMatchObject({ approvalPolicy: "read-only" });
	});

	it("maps a function policy to approvalPolicy 'untrusted' (conservative fallback)", () => {
		// OmniPermissionPolicy accepts a bare function (typeof === "function");
		// the mapper checks `typeof policy === "function"` to detect this branch.
		const policy = (() => "allow") as unknown as OmniAgentConfig["permissions"];
		const result = buildCodexOptions(makeConfig({ permissions: policy }));

		expect(result.config).toMatchObject({ approvalPolicy: "untrusted" });
	});

	it("does not write approvalPolicy when permissions is undefined", () => {
		const result = buildCodexOptions(makeConfig({}));

		// No config at all — approvalPolicy must be absent
		expect(result.config?.approvalPolicy).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Top-level OmniAgentConfig fields
// ---------------------------------------------------------------------------

describe("buildCodexOptions — top-level config fields", () => {
	it("writes model to codexConfig", () => {
		const result = buildCodexOptions(makeConfig({ model: "codex-mini" }));

		expect(result.config).toMatchObject({ model: "codex-mini" });
	});

	it("writes systemPrompt to codexConfig", () => {
		const result = buildCodexOptions(makeConfig({ systemPrompt: "You are helpful." }));

		expect(result.config).toMatchObject({ systemPrompt: "You are helpful." });
	});

	it("writes maxTurns to codexConfig", () => {
		const result = buildCodexOptions(makeConfig({ maxTurns: 10 }));

		expect(result.config).toMatchObject({ maxTurns: 10 });
	});

	it("writes maxBudgetUsd to codexConfig", () => {
		const result = buildCodexOptions(makeConfig({ maxBudgetUsd: 2.5 }));

		expect(result.config).toMatchObject({ maxBudgetUsd: 2.5 });
	});

	it("writes tools.allowed to codexConfig.allowedTools", () => {
		const result = buildCodexOptions(makeConfig({ tools: { allowed: ["bash", "read_file"] } }));

		expect(result.config).toMatchObject({ allowedTools: ["bash", "read_file"] });
	});

	it("writes tools.disallowed to codexConfig.disallowedTools", () => {
		const result = buildCodexOptions(makeConfig({ tools: { disallowed: ["rm_rf"] } }));

		expect(result.config).toMatchObject({ disallowedTools: ["rm_rf"] });
	});

	it("writes mcpServers to codexConfig", () => {
		const servers = { myServer: { url: "http://localhost:3000" } };
		const result = buildCodexOptions(makeConfig({ mcpServers: servers }));

		expect(result.config).toMatchObject({ mcpServers: servers });
	});

	it("does not write undefined top-level fields", () => {
		const result = buildCodexOptions(
			makeConfig({ model: undefined, systemPrompt: undefined, maxTurns: undefined }),
		);

		expect(result.config).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// env — top-level option, NOT inside config
// ---------------------------------------------------------------------------

describe("buildCodexOptions — env field", () => {
	it("writes env to top-level options.env, not inside config", () => {
		const env = { NODE_ENV: "test", API_KEY: "secret" };
		const result = buildCodexOptions(makeConfig({ env }));

		expect(result.env).toEqual(env);
		expect(result.config?.env).toBeUndefined();
	});

	it("does not set options.env when config.env is undefined", () => {
		const result = buildCodexOptions(makeConfig({ model: "codex-mini" }));

		expect(result.env).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// providerOptions — CodexProviderOptions fields
// ---------------------------------------------------------------------------

describe("buildCodexOptions — providerOptions.sandboxMode", () => {
	it("writes sandboxMode to codexConfig", () => {
		const result = buildCodexOptions(makeConfig({ providerOptions: { sandboxMode: "docker" } }));

		expect(result.config).toMatchObject({ sandboxMode: "docker" });
	});

	it("does not write sandboxMode when absent", () => {
		const result = buildCodexOptions(makeConfig({ providerOptions: {} }));

		expect(result.config?.sandboxMode).toBeUndefined();
	});
});

describe("buildCodexOptions — providerOptions.skipGitRepoCheck", () => {
	it("writes skipGitRepoCheck true to codexConfig", () => {
		const result = buildCodexOptions(makeConfig({ providerOptions: { skipGitRepoCheck: true } }));

		expect(result.config).toMatchObject({ skipGitRepoCheck: true });
	});

	it("writes skipGitRepoCheck false to codexConfig", () => {
		const result = buildCodexOptions(makeConfig({ providerOptions: { skipGitRepoCheck: false } }));

		expect(result.config).toMatchObject({ skipGitRepoCheck: false });
	});
});

describe("buildCodexOptions — providerOptions.modelReasoningEffort", () => {
	it.each(["low", "medium", "high"] as const)(
		"writes modelReasoningEffort '%s' to codexConfig",
		(effort) => {
			const result = buildCodexOptions(
				makeConfig({ providerOptions: { modelReasoningEffort: effort } }),
			);

			expect(result.config).toMatchObject({ modelReasoningEffort: effort });
		},
	);
});

describe("buildCodexOptions — providerOptions.features", () => {
	it("writes features record to codexConfig", () => {
		const features = { experimentalStreaming: true, betaUI: false };
		const result = buildCodexOptions(makeConfig({ providerOptions: { features } }));

		expect(result.config).toMatchObject({ features });
	});
});

describe("buildCodexOptions — providerOptions approvalPolicy", () => {
	it("does NOT expose the raw approvalPolicy providerOption — it is handled via permissions", () => {
		// approvalPolicy is a well-known CodexProviderOptions key that is destructured
		// away before spreading extraConfig. It must not leak through independently of
		// the permissions mapping.
		const result = buildCodexOptions(
			makeConfig({
				providerOptions: { approvalPolicy: "never" },
			}),
		);

		// permissions is undefined so approvalPolicy should not be written at all.
		expect(result.config?.approvalPolicy).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Extra / unknown providerOptions keys are spread into codexConfig
// ---------------------------------------------------------------------------

describe("buildCodexOptions — extra providerOptions keys", () => {
	it("spreads unknown providerOptions keys into codexConfig", () => {
		const result = buildCodexOptions(
			makeConfig({ providerOptions: { customFlag: true, networkMode: "offline" } }),
		);

		expect(result.config).toMatchObject({ customFlag: true, networkMode: "offline" });
	});

	it("does not include well-known keys in the spread", () => {
		const result = buildCodexOptions(
			makeConfig({
				providerOptions: {
					sandboxMode: "docker",
					skipGitRepoCheck: true,
					modelReasoningEffort: "low",
					features: {},
					customFlag: "yes",
				},
			}),
		);

		// customFlag from spread
		expect(result.config).toMatchObject({ customFlag: "yes" });
		// well-known keys should be written via their own code paths, not doubled
		const keys = Object.keys(result.config ?? {});
		expect(keys.filter((k) => k === "sandboxMode")).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// options.config is absent when there is nothing to write
// ---------------------------------------------------------------------------

describe("buildCodexOptions — absent config object", () => {
	it("omits options.config entirely when no config keys are produced", () => {
		const result = buildCodexOptions(makeConfig({}));

		expect(Object.prototype.hasOwnProperty.call(result, "config")).toBe(false);
	});

	it("omits options.config when providerOptions is explicitly empty", () => {
		const result = buildCodexOptions(makeConfig({ providerOptions: {} }));

		expect(result.config).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Combined / integration-style scenarios
// ---------------------------------------------------------------------------

describe("buildCodexOptions — combined config", () => {
	it("builds a fully-populated options object from a rich config", () => {
		const result = buildCodexOptions(
			makeConfig({
				model: "codex-1",
				systemPrompt: "Be concise.",
				maxTurns: 5,
				maxBudgetUsd: 1.0,
				permissions: "ask",
				env: { HOME: "/root" },
				tools: { allowed: ["bash"], disallowed: ["rm_rf"] },
				mcpServers: { db: { url: "http://db:3001" } },
				providerOptions: {
					sandboxMode: "none",
					skipGitRepoCheck: false,
					modelReasoningEffort: "high",
					features: { newUI: true },
					extraKey: "extra",
				},
			}),
		);

		expect(result.env).toEqual({ HOME: "/root" });
		expect(result.config).toMatchObject({
			model: "codex-1",
			systemPrompt: "Be concise.",
			maxTurns: 5,
			maxBudgetUsd: 1.0,
			approvalPolicy: "untrusted",
			allowedTools: ["bash"],
			disallowedTools: ["rm_rf"],
			mcpServers: { db: { url: "http://db:3001" } },
			sandboxMode: "none",
			skipGitRepoCheck: false,
			modelReasoningEffort: "high",
			features: { newUI: true },
			extraKey: "extra",
		});
	});

	it("env does not appear inside config even when other keys are present", () => {
		const result = buildCodexOptions(makeConfig({ model: "codex-1", env: { X: "1" } }));

		expect(result.env).toEqual({ X: "1" });
		expect(result.config?.env).toBeUndefined();
	});
});
