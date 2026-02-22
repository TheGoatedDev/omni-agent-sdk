import type { OmniAgentConfig } from "@omni-agent-sdk/core";

export interface ClaudeProviderOptions {
	permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan";
	enableFileCheckpointing?: boolean;
	executable?: string;
	settingSources?: string[];
	betas?: string[];
}

export interface ClaudeAgentConfig extends OmniAgentConfig {
	providerOptions?: ClaudeProviderOptions & Record<string, unknown>;
}
