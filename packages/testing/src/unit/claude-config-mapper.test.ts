import type { OmniAgentConfig } from "@omni-agent-sdk/core";
import { mapConfig } from "../../../provider-claude/src/mappers/config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid OmniAgentConfig with no optional fields set. */
function baseConfig(overrides: Partial<OmniAgentConfig> = {}): OmniAgentConfig {
	return { ...overrides };
}

// ---------------------------------------------------------------------------
// Empty config
// ---------------------------------------------------------------------------

describe("mapConfig — empty config", () => {
	it("returns an empty options object when config has no fields", () => {
		const options = mapConfig(baseConfig());
		expect(options).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// model
// ---------------------------------------------------------------------------

describe("mapConfig — model", () => {
	it("maps config.model to options.model", () => {
		const options = mapConfig(baseConfig({ model: "claude-3-opus" }));
		expect(options.model).toBe("claude-3-opus");
	});

	it("does not set options.model when config.model is undefined", () => {
		const options = mapConfig(baseConfig());
		expect("model" in options).toBe(false);
	});

	it("promptOverrides.model overrides config.model", () => {
		const options = mapConfig(baseConfig({ model: "claude-3-opus" }), {
			model: "claude-3-haiku",
		});
		expect(options.model).toBe("claude-3-haiku");
	});

	it("promptOverrides.model is used when config.model is undefined", () => {
		const options = mapConfig(baseConfig(), { model: "claude-3-sonnet" });
		expect(options.model).toBe("claude-3-sonnet");
	});
});

// ---------------------------------------------------------------------------
// systemPrompt
// ---------------------------------------------------------------------------

describe("mapConfig — systemPrompt", () => {
	it("maps config.systemPrompt to options.systemPrompt", () => {
		const options = mapConfig(baseConfig({ systemPrompt: "You are helpful." }));
		expect(options.systemPrompt).toBe("You are helpful.");
	});

	it("does not set options.systemPrompt when config.systemPrompt is undefined", () => {
		const options = mapConfig(baseConfig());
		expect("systemPrompt" in options).toBe(false);
	});

	it("promptOverrides.systemPrompt overrides config.systemPrompt", () => {
		const options = mapConfig(baseConfig({ systemPrompt: "original" }), {
			systemPrompt: "overridden",
		});
		expect(options.systemPrompt).toBe("overridden");
	});

	it("promptOverrides.systemPrompt is used when config.systemPrompt is undefined", () => {
		const options = mapConfig(baseConfig(), { systemPrompt: "from override" });
		expect(options.systemPrompt).toBe("from override");
	});
});

// ---------------------------------------------------------------------------
// maxTurns
// ---------------------------------------------------------------------------

describe("mapConfig — maxTurns", () => {
	it("maps config.maxTurns to options.maxTurns", () => {
		const options = mapConfig(baseConfig({ maxTurns: 10 }));
		expect(options.maxTurns).toBe(10);
	});

	it("does not set options.maxTurns when config.maxTurns is undefined", () => {
		const options = mapConfig(baseConfig());
		expect("maxTurns" in options).toBe(false);
	});

	it("promptOverrides.maxTurns overrides config.maxTurns", () => {
		const options = mapConfig(baseConfig({ maxTurns: 10 }), { maxTurns: 25 });
		expect(options.maxTurns).toBe(25);
	});

	it("promptOverrides.maxTurns is used when config.maxTurns is undefined", () => {
		const options = mapConfig(baseConfig(), { maxTurns: 5 });
		expect(options.maxTurns).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// maxBudgetUsd
// ---------------------------------------------------------------------------

describe("mapConfig — maxBudgetUsd", () => {
	it("maps config.maxBudgetUsd to options.maxBudgetUsd", () => {
		const options = mapConfig(baseConfig({ maxBudgetUsd: 1.5 }));
		expect(options.maxBudgetUsd).toBe(1.5);
	});

	it("does not set options.maxBudgetUsd when config.maxBudgetUsd is undefined", () => {
		const options = mapConfig(baseConfig());
		expect("maxBudgetUsd" in options).toBe(false);
	});

	it("promptOverrides.maxBudgetUsd overrides config.maxBudgetUsd", () => {
		const options = mapConfig(baseConfig({ maxBudgetUsd: 1.0 }), { maxBudgetUsd: 5.0 });
		expect(options.maxBudgetUsd).toBe(5.0);
	});

	it("promptOverrides.maxBudgetUsd is used when config.maxBudgetUsd is undefined", () => {
		const options = mapConfig(baseConfig(), { maxBudgetUsd: 2.5 });
		expect(options.maxBudgetUsd).toBe(2.5);
	});
});

// ---------------------------------------------------------------------------
// cwd
// ---------------------------------------------------------------------------

describe("mapConfig — cwd", () => {
	it("maps config.cwd to options.cwd", () => {
		const options = mapConfig(baseConfig({ cwd: "/home/user/project" }));
		expect(options.cwd).toBe("/home/user/project");
	});

	it("does not set options.cwd when config.cwd is undefined", () => {
		const options = mapConfig(baseConfig());
		expect("cwd" in options).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// permissions — policy string mapping
// ---------------------------------------------------------------------------

describe("mapConfig — permissions (auto-approve)", () => {
	it("maps auto-approve to permissionMode bypassPermissions", () => {
		const options = mapConfig(baseConfig({ permissions: "auto-approve" }));
		expect(options.permissionMode).toBe("bypassPermissions");
	});

	it("sets allowDangerouslySkipPermissions to true for auto-approve", () => {
		const options = mapConfig(baseConfig({ permissions: "auto-approve" }));
		expect(options.allowDangerouslySkipPermissions).toBe(true);
	});
});

describe("mapConfig — permissions (approve-edits)", () => {
	it("maps approve-edits to permissionMode acceptEdits", () => {
		const options = mapConfig(baseConfig({ permissions: "approve-edits" }));
		expect(options.permissionMode).toBe("acceptEdits");
	});

	it("does not set allowDangerouslySkipPermissions for approve-edits", () => {
		const options = mapConfig(baseConfig({ permissions: "approve-edits" }));
		expect(options.allowDangerouslySkipPermissions).toBeUndefined();
	});
});

describe("mapConfig — permissions (ask)", () => {
	it("maps ask to permissionMode default", () => {
		const options = mapConfig(baseConfig({ permissions: "ask" }));
		expect(options.permissionMode).toBe("default");
	});

	it("does not set allowDangerouslySkipPermissions for ask", () => {
		const options = mapConfig(baseConfig({ permissions: "ask" }));
		expect(options.allowDangerouslySkipPermissions).toBeUndefined();
	});
});

describe("mapConfig — permissions (plan-only)", () => {
	it("maps plan-only to permissionMode plan", () => {
		const options = mapConfig(baseConfig({ permissions: "plan-only" }));
		expect(options.permissionMode).toBe("plan");
	});

	it("does not set allowDangerouslySkipPermissions for plan-only", () => {
		const options = mapConfig(baseConfig({ permissions: "plan-only" }));
		expect(options.allowDangerouslySkipPermissions).toBeUndefined();
	});
});

describe("mapConfig — permissions (function policy)", () => {
	it("does not set permissionMode when permissions is a function", () => {
		const options = mapConfig(
			baseConfig({
				permissions: {
					canUseTool: async () => "allow",
				},
			}),
		);
		expect("permissionMode" in options).toBe(false);
	});
});

describe("mapConfig — permissions (undefined)", () => {
	it("does not set permissionMode when permissions is undefined", () => {
		const options = mapConfig(baseConfig());
		expect("permissionMode" in options).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// providerOptions.permissionMode override
// ---------------------------------------------------------------------------

describe("mapConfig — providerOptions.permissionMode override", () => {
	it("overrides policy-based permissionMode when providerOptions.permissionMode is set", () => {
		const options = mapConfig(
			baseConfig({
				permissions: "ask",
				providerOptions: { permissionMode: "acceptEdits" },
			}),
		);
		// providerOptions wins over the "ask" → "default" mapping
		expect(options.permissionMode).toBe("acceptEdits");
	});

	it("sets bypassPermissions and allowDangerouslySkipPermissions via providerOptions", () => {
		const options = mapConfig(
			baseConfig({
				providerOptions: { permissionMode: "bypassPermissions" },
			}),
		);
		expect(options.permissionMode).toBe("bypassPermissions");
		expect(options.allowDangerouslySkipPermissions).toBe(true);
	});

	it("uses providerOptions.permissionMode even when policy is undefined", () => {
		const options = mapConfig(baseConfig({ providerOptions: { permissionMode: "plan" } }));
		expect(options.permissionMode).toBe("plan");
	});
});

// ---------------------------------------------------------------------------
// tools
// ---------------------------------------------------------------------------

describe("mapConfig — tools.allowed", () => {
	it("maps config.tools.allowed to options.allowedTools", () => {
		const options = mapConfig(baseConfig({ tools: { allowed: ["bash", "read_file"] } }));
		expect(options.allowedTools).toEqual(["bash", "read_file"]);
	});

	it("does not set options.allowedTools when tools.allowed is undefined", () => {
		const options = mapConfig(baseConfig({ tools: {} }));
		expect("allowedTools" in options).toBe(false);
	});

	it("does not set options.allowedTools when tools is undefined", () => {
		const options = mapConfig(baseConfig());
		expect("allowedTools" in options).toBe(false);
	});
});

describe("mapConfig — tools.disallowed", () => {
	it("maps config.tools.disallowed to options.disallowedTools", () => {
		const options = mapConfig(baseConfig({ tools: { disallowed: ["write_file"] } }));
		expect(options.disallowedTools).toEqual(["write_file"]);
	});

	it("does not set options.disallowedTools when tools.disallowed is undefined", () => {
		const options = mapConfig(baseConfig({ tools: {} }));
		expect("disallowedTools" in options).toBe(false);
	});

	it("maps both allowed and disallowed lists together", () => {
		const options = mapConfig(baseConfig({ tools: { allowed: ["bash"], disallowed: ["rm"] } }));
		expect(options.allowedTools).toEqual(["bash"]);
		expect(options.disallowedTools).toEqual(["rm"]);
	});
});

// ---------------------------------------------------------------------------
// env
// ---------------------------------------------------------------------------

describe("mapConfig — env", () => {
	it("maps config.env to options.env", () => {
		const env = { NODE_ENV: "test", API_KEY: "secret" };
		const options = mapConfig(baseConfig({ env }));
		expect(options.env).toEqual(env);
	});

	it("does not set options.env when config.env is undefined", () => {
		const options = mapConfig(baseConfig());
		expect("env" in options).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// mcpServers
// ---------------------------------------------------------------------------

describe("mapConfig — mcpServers (stdio / command)", () => {
	it("maps a server with a command to a stdio McpServerConfig", () => {
		const options = mapConfig(
			baseConfig({
				mcpServers: {
					myServer: { command: "node", args: ["server.js"], env: { PORT: "3000" } },
				},
			}),
		);
		expect(options.mcpServers?.myServer).toEqual({
			command: "node",
			args: ["server.js"],
			env: { PORT: "3000" },
		});
	});

	it("maps a stdio server without args or env correctly", () => {
		const options = mapConfig(baseConfig({ mcpServers: { minimal: { command: "npx" } } }));
		expect(options.mcpServers?.minimal).toEqual({ command: "npx" });
		expect((options.mcpServers?.minimal as { args?: unknown }).args).toBeUndefined();
		expect((options.mcpServers?.minimal as { env?: unknown }).env).toBeUndefined();
	});

	it("maps a stdio server with args but no env", () => {
		const options = mapConfig(
			baseConfig({ mcpServers: { s: { command: "python", args: ["-m", "server"] } } }),
		);
		expect(options.mcpServers?.s).toEqual({ command: "python", args: ["-m", "server"] });
	});

	it("maps a stdio server with env but no args", () => {
		const options = mapConfig(
			baseConfig({ mcpServers: { s: { command: "ruby", env: { RACK_ENV: "dev" } } } }),
		);
		expect(options.mcpServers?.s).toEqual({ command: "ruby", env: { RACK_ENV: "dev" } });
	});
});

describe("mapConfig — mcpServers (url)", () => {
	it("maps a server with a url to a url-based McpServerConfig", () => {
		const options = mapConfig(
			baseConfig({ mcpServers: { remote: { url: "https://mcp.example.com/sse" } } }),
		);
		expect(options.mcpServers?.remote).toEqual({ url: "https://mcp.example.com/sse" });
	});
});

describe("mapConfig — mcpServers (neither command nor url)", () => {
	it("skips a server entry that has neither command nor url", () => {
		const options = mapConfig(baseConfig({ mcpServers: { broken: {} } }));
		expect(options.mcpServers?.broken).toBeUndefined();
	});

	it("skips invalid entries while still mapping valid ones", () => {
		const options = mapConfig(
			baseConfig({
				mcpServers: {
					good: { command: "node" },
					bad: {},
				},
			}),
		);
		expect(options.mcpServers?.good).toEqual({ command: "node" });
		expect(options.mcpServers?.bad).toBeUndefined();
	});
});

describe("mapConfig — mcpServers (undefined)", () => {
	it("does not set options.mcpServers when config.mcpServers is undefined", () => {
		const options = mapConfig(baseConfig());
		expect("mcpServers" in options).toBe(false);
	});
});

describe("mapConfig — mcpServers (multiple servers)", () => {
	it("maps multiple servers correctly", () => {
		const options = mapConfig(
			baseConfig({
				mcpServers: {
					local: { command: "node", args: ["local.js"] },
					remote: { url: "https://example.com" },
				},
			}),
		);
		expect(options.mcpServers?.local).toEqual({ command: "node", args: ["local.js"] });
		expect(options.mcpServers?.remote).toEqual({ url: "https://example.com" });
	});
});

// ---------------------------------------------------------------------------
// promptOverrides interaction — combined
// ---------------------------------------------------------------------------

describe("mapConfig — promptOverrides combined", () => {
	it("applies all override fields simultaneously", () => {
		const config = baseConfig({
			model: "claude-3-opus",
			systemPrompt: "original",
			maxTurns: 5,
			maxBudgetUsd: 1.0,
		});
		const options = mapConfig(config, {
			model: "claude-3-haiku",
			systemPrompt: "overridden",
			maxTurns: 20,
			maxBudgetUsd: 9.99,
		});
		expect(options.model).toBe("claude-3-haiku");
		expect(options.systemPrompt).toBe("overridden");
		expect(options.maxTurns).toBe(20);
		expect(options.maxBudgetUsd).toBe(9.99);
	});

	it("falls back to config values when promptOverrides fields are undefined", () => {
		const config = baseConfig({
			model: "claude-3-opus",
			systemPrompt: "base prompt",
			maxTurns: 10,
			maxBudgetUsd: 2.0,
		});
		const options = mapConfig(config, {});
		expect(options.model).toBe("claude-3-opus");
		expect(options.systemPrompt).toBe("base prompt");
		expect(options.maxTurns).toBe(10);
		expect(options.maxBudgetUsd).toBe(2.0);
	});
});

// ---------------------------------------------------------------------------
// Claude-specific providerOptions
// ---------------------------------------------------------------------------

describe("mapConfig — providerOptions.executable", () => {
	it("maps executable to pathToClaudeCodeExecutable", () => {
		const options = mapConfig(
			baseConfig({ providerOptions: { executable: "/usr/local/bin/claude" } }),
		);
		expect(options.pathToClaudeCodeExecutable).toBe("/usr/local/bin/claude");
	});

	it("does not set pathToClaudeCodeExecutable when executable is undefined", () => {
		const options = mapConfig(baseConfig());
		expect("pathToClaudeCodeExecutable" in options).toBe(false);
	});
});

describe("mapConfig — providerOptions.enableFileCheckpointing", () => {
	it("maps enableFileCheckpointing to options.enableFileCheckpointing", () => {
		const options = mapConfig(baseConfig({ providerOptions: { enableFileCheckpointing: true } }));
		expect(options.enableFileCheckpointing).toBe(true);
	});

	it("does not set enableFileCheckpointing when undefined", () => {
		const options = mapConfig(baseConfig());
		expect("enableFileCheckpointing" in options).toBe(false);
	});
});

describe("mapConfig — providerOptions.settingSources", () => {
	it("maps settingSources to options.settingSources", () => {
		const options = mapConfig(
			baseConfig({ providerOptions: { settingSources: ["user", "project"] } }),
		);
		expect(options.settingSources).toEqual(["user", "project"]);
	});

	it("does not set settingSources when undefined", () => {
		const options = mapConfig(baseConfig());
		expect("settingSources" in options).toBe(false);
	});
});

describe("mapConfig — providerOptions.betas", () => {
	it("maps betas to options.betas", () => {
		const options = mapConfig(
			baseConfig({ providerOptions: { betas: ["interleaved-thinking-2025-05-14"] } }),
		);
		expect(options.betas).toEqual(["interleaved-thinking-2025-05-14"]);
	});

	it("does not set betas when undefined", () => {
		const options = mapConfig(baseConfig());
		expect("betas" in options).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Full config round-trip
// ---------------------------------------------------------------------------

describe("mapConfig — full config round-trip", () => {
	it("maps a fully-populated config without promptOverrides", () => {
		const config: OmniAgentConfig = {
			model: "claude-3-opus",
			systemPrompt: "You are a code assistant.",
			maxTurns: 15,
			maxBudgetUsd: 3.0,
			cwd: "/workspace",
			permissions: "approve-edits",
			tools: { allowed: ["bash", "read_file"], disallowed: ["write_file"] },
			mcpServers: {
				local: { command: "node", args: ["mcp.js"] },
				remote: { url: "https://mcp.example.com" },
			},
			env: { ENV_VAR: "value" },
			providerOptions: {
				executable: "/bin/claude",
				enableFileCheckpointing: false,
				settingSources: ["user"],
				betas: ["beta-feature"],
			},
		};

		const options = mapConfig(config);

		expect(options.model).toBe("claude-3-opus");
		expect(options.systemPrompt).toBe("You are a code assistant.");
		expect(options.maxTurns).toBe(15);
		expect(options.maxBudgetUsd).toBe(3.0);
		expect(options.cwd).toBe("/workspace");
		expect(options.permissionMode).toBe("acceptEdits");
		expect(options.allowDangerouslySkipPermissions).toBeUndefined();
		expect(options.allowedTools).toEqual(["bash", "read_file"]);
		expect(options.disallowedTools).toEqual(["write_file"]);
		expect(options.mcpServers?.local).toEqual({ command: "node", args: ["mcp.js"] });
		expect(options.mcpServers?.remote).toEqual({ url: "https://mcp.example.com" });
		expect(options.env).toEqual({ ENV_VAR: "value" });
		expect(options.pathToClaudeCodeExecutable).toBe("/bin/claude");
		expect(options.enableFileCheckpointing).toBe(false);
		expect(options.settingSources).toEqual(["user"]);
		expect(options.betas).toEqual(["beta-feature"]);
	});
});
