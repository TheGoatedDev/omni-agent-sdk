/**
 * Import verification script — confirms all public exports are accessible.
 * Not a test runner; just type-checks and exercises the export surfaces.
 *
 * Run with: npx tsx test-imports.ts (requires tsx installed)
 * Or type-check only: tsc --noEmit test-imports.ts
 */

import type {
	OmniAgent,
	OmniAgentConfig,
	OmniEvent,
	OmniMessage,
	OmniSession,
	OmniStream,
	OmniUsage,
	PromptInput,
	PromptResult,
} from "@omni-agent-sdk/core";
import { AbortError, BudgetExceededError, OmniAgentError } from "@omni-agent-sdk/core";
import { createAgent as createClaude } from "@omni-agent-sdk/provider-claude";
import type { ClaudeAgentConfig } from "@omni-agent-sdk/provider-claude";
import { createAgent as createCodex } from "@omni-agent-sdk/provider-codex";
import type { CodexAgentConfig } from "@omni-agent-sdk/provider-codex";

// ── Type assertions ──────────────────────────────────────────────────────────

const _config: OmniAgentConfig = {
	model: "claude-opus-4-6",
	permissions: "ask",
	cwd: "/tmp",
	maxTurns: 10,
};

const _claudeConfig: ClaudeAgentConfig = {
	..._config,
	providerOptions: { permissionMode: "default" },
};

const _codexConfig: CodexAgentConfig = {
	..._config,
	providerOptions: { approvalPolicy: "untrusted" },
};

// ── Factory functions return the right interface ──────────────────────────────

const claudeAgent: OmniAgent = createClaude(_claudeConfig);
const codexAgent: OmniAgent = createCodex(_codexConfig);

console.log("✓ createClaude() returns OmniAgent, provider:", claudeAgent.provider);
console.log("✓ createCodex() returns OmniAgent, provider:", codexAgent.provider);

// ── Error hierarchy ───────────────────────────────────────────────────────────

const err = new OmniAgentError("test", { provider: "test", code: "UNKNOWN" });
const abort = new AbortError({ provider: "test" });
const budget = new BudgetExceededError({ provider: "test" });

console.log("✓ OmniAgentError:", err.code, err.provider);
console.log(
	"✓ AbortError:",
	abort.code,
	"instanceof OmniAgentError:",
	abort instanceof OmniAgentError,
);
console.log(
	"✓ BudgetExceededError:",
	budget.code,
	"instanceof OmniAgentError:",
	budget instanceof OmniAgentError,
);

// ── Type-level checks (these are compile-time only) ───────────────────────────

type _AssertEventUnion = OmniEvent extends { type: string } ? true : false;
type _AssertStreamDisposable = OmniStream extends AsyncDisposable ? true : false;
type _AssertAgentInterface = typeof claudeAgent extends OmniAgent ? true : false;
type _AssertSessionInterface = Awaited<ReturnType<OmniAgent["createSession"]>> extends OmniSession
	? true
	: false;

// Suppress unused variable warnings for the type assertions
void (null as unknown as _AssertEventUnion);
void (null as unknown as _AssertStreamDisposable);
void (null as unknown as _AssertAgentInterface);
void (null as unknown as _AssertSessionInterface);

// Suppress unused import warnings
void (_config satisfies OmniAgentConfig);
void (abort satisfies OmniAgentError);

// These are just for type-checking, not runtime
type _UsageRef = OmniUsage;
type _MessageRef = OmniMessage;
type _PromptInputRef = PromptInput;
type _PromptResultRef = PromptResult;

console.log("\nAll import checks passed.");
