import type {
	McpServerConfig,
	McpStdioServerConfig,
	Options,
} from "@anthropic-ai/claude-agent-sdk";
import type { OmniAgentConfig, OmniMcpServerConfig } from "@omni-agent-sdk/core";
import type { ClaudeProviderOptions } from "../types.js";

const PERMISSION_MAP = {
	"auto-approve": "bypassPermissions",
	"approve-edits": "acceptEdits",
	ask: "default",
	"plan-only": "plan",
} as const satisfies Record<string, Options["permissionMode"]>;

function mapPermissions(policy: OmniAgentConfig["permissions"]): Options["permissionMode"] {
	if (!policy || typeof policy === "object") {
		return undefined;
	}
	return PERMISSION_MAP[policy];
}

/**
 * Maps a single OmniMcpServerConfig to a McpServerConfig.
 * We produce a McpStdioServerConfig when a command is present, otherwise
 * we fall back to a URL-based SSE config. If neither is available the entry
 * is skipped by the caller.
 */
function mapMcpServer(cfg: OmniMcpServerConfig): McpServerConfig | undefined {
	if (cfg.command !== undefined) {
		const stdio: McpStdioServerConfig = {
			command: cfg.command,
			...(cfg.args !== undefined ? { args: cfg.args } : {}),
			...(cfg.env !== undefined ? { env: cfg.env } : {}),
		};
		return stdio;
	}
	if (cfg.url !== undefined) {
		// SSE / HTTP server config — McpSSEServerConfig or McpHttpServerConfig.
		// Both share the `url` field at minimum; we cast via a known-safe subset.
		return { url: cfg.url } as McpServerConfig;
	}
	return undefined;
}

function mapMcpServers(
	servers: Record<string, OmniMcpServerConfig>,
): Record<string, McpServerConfig> {
	const result: Record<string, McpServerConfig> = {};
	for (const [name, cfg] of Object.entries(servers)) {
		const mapped = mapMcpServer(cfg);
		if (mapped !== undefined) {
			result[name] = mapped;
		}
	}
	return result;
}

export interface PromptOverrides {
	model?: string;
	systemPrompt?: string;
	maxTurns?: number;
	maxBudgetUsd?: number;
}

/**
 * Maps OmniAgentConfig (plus optional per-prompt overrides) into the Options
 * object accepted by the claude-agent-sdk `query()` function.
 */
export function mapConfig(config: OmniAgentConfig, promptOverrides?: PromptOverrides): Options {
	const providerOptions = (config.providerOptions ?? {}) as ClaudeProviderOptions;

	const options: Options = {};

	// Model: prompt-level takes precedence over agent-level
	const model = promptOverrides?.model ?? config.model;
	if (model !== undefined) {
		options.model = model;
	}

	// System prompt: prompt-level takes precedence
	const systemPrompt = promptOverrides?.systemPrompt ?? config.systemPrompt;
	if (systemPrompt !== undefined) {
		options.systemPrompt = systemPrompt;
	}

	// Max turns: prompt-level takes precedence
	const maxTurns = promptOverrides?.maxTurns ?? config.maxTurns;
	if (maxTurns !== undefined) {
		options.maxTurns = maxTurns;
	}

	// Max budget: prompt-level takes precedence
	const maxBudgetUsd = promptOverrides?.maxBudgetUsd ?? config.maxBudgetUsd;
	if (maxBudgetUsd !== undefined) {
		options.maxBudgetUsd = maxBudgetUsd;
	}

	// Working directory
	if (config.cwd !== undefined) {
		options.cwd = config.cwd;
	}

	// Permission mode from policy
	const permissionMode = providerOptions.permissionMode ?? mapPermissions(config.permissions);
	if (permissionMode !== undefined) {
		options.permissionMode = permissionMode;
		// bypassPermissions requires an additional safety flag
		if (permissionMode === "bypassPermissions") {
			options.allowDangerouslySkipPermissions = true;
		}
	}

	// Tool allow/disallow lists
	if (config.tools?.allowed !== undefined) {
		options.allowedTools = config.tools.allowed;
	}
	if (config.tools?.disallowed !== undefined) {
		options.disallowedTools = config.tools.disallowed;
	}

	// MCP servers: transform from OmniMcpServerConfig to McpServerConfig
	if (config.mcpServers !== undefined) {
		options.mcpServers = mapMcpServers(config.mcpServers);
	}

	// Environment variables
	if (config.env !== undefined) {
		options.env = config.env;
	}

	// Claude-specific provider options
	if (providerOptions.executable !== undefined) {
		options.pathToClaudeCodeExecutable = providerOptions.executable;
	}
	if (providerOptions.enableFileCheckpointing !== undefined) {
		options.enableFileCheckpointing = providerOptions.enableFileCheckpointing;
	}
	if (providerOptions.settingSources !== undefined) {
		// Options['settingSources'] is SettingSource[] = ('user'|'project'|'local')[]
		// ClaudeProviderOptions.settingSources is string[] for flexibility; cast is safe.
		options.settingSources = providerOptions.settingSources as Options["settingSources"];
	}
	if (providerOptions.betas !== undefined) {
		// Options['betas'] is SdkBeta[] (string union). Cast is safe.
		options.betas = providerOptions.betas as Options["betas"];
	}

	return options;
}
