export type JsonSchema = Record<string, unknown>;

export interface ToolPermissionRequest {
	toolName: string;
	input?: unknown;
	sessionId: string;
}

export type OmniPermissionPolicy =
	| "auto-approve"
	| "approve-edits"
	| "ask"
	| "plan-only"
	| { canUseTool: (req: ToolPermissionRequest) => Promise<"allow" | "deny" | "ask"> };

export interface OmniMcpServerConfig {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	url?: string;
}

export interface OmniAgentConfig {
	model?: string;
	permissions?: OmniPermissionPolicy;
	cwd?: string;
	systemPrompt?: string;
	maxBudgetUsd?: number;
	maxTurns?: number;
	tools?: {
		allowed?: string[];
		disallowed?: string[];
	};
	mcpServers?: Record<string, OmniMcpServerConfig>;
	env?: Record<string, string>;
	providerOptions?: Record<string, unknown>;
}
