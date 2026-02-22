import type { OmniPermissionPolicy } from "@omni-agent-sdk/core";
import type { CodexOptions } from "@openai/codex-sdk";
import type { CodexAgentConfig, CodexProviderOptions } from "../types.js";

/**
 * Map an OmniPermissionPolicy to the Codex approvalPolicy string.
 *
 * Mapping:
 *   "auto-approve"  -> "never"       (never ask; full access)
 *   "approve-edits" -> "on-request"  (ask for write operations)
 *   "ask"           -> "untrusted"   (ask for most things)
 *   "plan-only"     -> "read-only"   (read-only sandbox)
 *   function policy -> "untrusted"   (conservative fallback)
 */
function mapPermissionPolicy(
	policy: OmniPermissionPolicy | undefined,
): CodexProviderOptions["approvalPolicy"] {
	if (policy === undefined) {
		return undefined;
	}
	if (typeof policy === "function") {
		// Custom function-based policies cannot be forwarded to the Codex SDK;
		// fall back to the most conservative non-blocking policy.
		return "untrusted";
	}
	switch (policy) {
		case "auto-approve":
			return "never";
		case "approve-edits":
			return "on-request";
		case "ask":
			return "untrusted";
		case "plan-only":
			return "read-only";
	}
}

/**
 * Build the CodexOptions object that is passed to `new Codex(...)`.
 *
 * Only env and opaque config keys are forwarded here; everything else
 * (model, cwd, permissions) is applied per-thread or per-run.
 */
export function buildCodexOptions(config: CodexAgentConfig): CodexOptions {
	const providerOpts = config.providerOptions ?? {};

	// Extract well-known CodexProviderOptions keys and forward the rest as
	// opaque config so that unknown provider options are not silently dropped.
	const {
		approvalPolicy: _approvalPolicy,
		sandboxMode: _sandboxMode,
		skipGitRepoCheck: _skipGitRepoCheck,
		modelReasoningEffort: _modelReasoningEffort,
		features: _features,
		...extraConfig
	} = providerOpts as CodexProviderOptions & Record<string, unknown>;

	const codexConfig: Record<string, unknown> = { ...extraConfig };

	const mappedPolicy = mapPermissionPolicy(config.permissions);
	if (mappedPolicy !== undefined) {
		codexConfig.approvalPolicy = mappedPolicy;
	}

	if (_sandboxMode !== undefined) {
		codexConfig.sandboxMode = _sandboxMode;
	}

	if (_skipGitRepoCheck !== undefined) {
		codexConfig.skipGitRepoCheck = _skipGitRepoCheck;
	}

	if (_modelReasoningEffort !== undefined) {
		codexConfig.modelReasoningEffort = _modelReasoningEffort;
	}

	if (_features !== undefined) {
		codexConfig.features = _features;
	}

	if (config.model !== undefined) {
		codexConfig.model = config.model;
	}

	if (config.systemPrompt !== undefined) {
		codexConfig.systemPrompt = config.systemPrompt;
	}

	if (config.maxTurns !== undefined) {
		codexConfig.maxTurns = config.maxTurns;
	}

	if (config.maxBudgetUsd !== undefined) {
		codexConfig.maxBudgetUsd = config.maxBudgetUsd;
	}

	if (config.tools?.allowed !== undefined) {
		codexConfig.allowedTools = config.tools.allowed;
	}

	if (config.tools?.disallowed !== undefined) {
		codexConfig.disallowedTools = config.tools.disallowed;
	}

	if (config.mcpServers !== undefined) {
		codexConfig.mcpServers = config.mcpServers;
	}

	const options: CodexOptions = {};

	if (config.env !== undefined) {
		options.env = config.env;
	}

	if (Object.keys(codexConfig).length > 0) {
		options.config = codexConfig;
	}

	return options;
}
