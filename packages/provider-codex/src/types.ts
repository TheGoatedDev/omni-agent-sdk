import type { OmniAgentConfig } from "@omni-agent-sdk/core";

export interface CodexProviderOptions {
	approvalPolicy?: "never" | "on-request" | "untrusted" | "read-only";
	sandboxMode?: string;
	skipGitRepoCheck?: boolean;
	modelReasoningEffort?: "low" | "medium" | "high";
	features?: Record<string, boolean>;
}

export interface CodexAgentConfig extends OmniAgentConfig {
	providerOptions?: CodexProviderOptions & Record<string, unknown>;
}
