# Provider Options

All providers accept a `providerOptions` field that passes settings through to the underlying SDK — things not covered by `OmniAgentConfig`. The provider packages export typed interfaces so you still get autocomplete and type checking.

---

## When to Use

Most tasks work fine with just the standard `OmniAgentConfig` fields. Reach for `providerOptions` when you need something provider-specific: a native permission mode, extended thinking betas for Claude, or reasoning effort tuning for Codex o-series models.

---

## Claude Provider Options

Use `ClaudeAgentConfig` from `@omni-agent-sdk/provider-claude` for full type safety.

```typescript
import { createAgent } from "@omni-agent-sdk/provider-claude";
import type { ClaudeAgentConfig } from "@omni-agent-sdk/provider-claude";

const config: ClaudeAgentConfig = {
  model: "claude-opus-4-6",
  permissions: "auto-approve",
  providerOptions: {
    permissionMode: "acceptEdits",
    enableFileCheckpointing: true,
    betas: ["interleaved-thinking-2025-05-14"],
  },
};

const agent = createAgent(config);
```

### `ClaudeProviderOptions` Fields

| Field | Type | Description |
|---|---|---|
| `permissionMode` | `"default" \| "acceptEdits" \| "bypassPermissions" \| "plan"` | Permission mode passed directly to the underlying `claude-agent-sdk`. |
| `enableFileCheckpointing` | `boolean` | Enable file checkpointing so the agent can restore state after interruption. |
| `executable` | `string` | Path to the Claude CLI executable, if it's not on `PATH`. |
| `settingSources` | `string[]` | Additional Claude settings files to load, in priority order. |
| `betas` | `string[]` | Beta feature identifiers to enable (e.g., extended thinking). |

---

## Codex Provider Options

Use `CodexAgentConfig` from `@omni-agent-sdk/provider-codex` for full type safety.

```typescript
import { createAgent } from "@omni-agent-sdk/provider-codex";
import type { CodexAgentConfig } from "@omni-agent-sdk/provider-codex";

const config: CodexAgentConfig = {
  model: "o3",
  permissions: "auto-approve",
  providerOptions: {
    approvalPolicy: "never",
    modelReasoningEffort: "medium",
    skipGitRepoCheck: true,
  },
};

const agent = createAgent(config);
```

### `CodexProviderOptions` Fields

| Field | Type | Description |
|---|---|---|
| `approvalPolicy` | `"never" \| "on-request" \| "untrusted" \| "read-only"` | Tool approval policy passed to the underlying `codex-sdk`. |
| `sandboxMode` | `string` | Sandbox mode identifier for the Codex runtime. |
| `skipGitRepoCheck` | `boolean` | Skip the git repository check on startup. |
| `modelReasoningEffort` | `"low" \| "medium" \| "high"` | Reasoning effort for o-series models. Higher effort uses more tokens. |
| `features` | `Record<string, boolean>` | Feature flags for the Codex runtime. |

---

## OpenCode Provider Options

Use `OpenCodeAgentConfig` from `@omni-agent-sdk/provider-opencode` for full type safety.

```typescript
import { createAgent } from "@omni-agent-sdk/provider-opencode";
import type { OpenCodeAgentConfig } from "@omni-agent-sdk/provider-opencode";

// Client-only mode: connect to a running OpenCode server
const config: OpenCodeAgentConfig = {
  model: "anthropic/claude-opus-4-6",
  providerOptions: {
    baseUrl: "http://localhost:4096",
  },
};

// Embedded mode: start a local OpenCode server automatically (omit baseUrl)
const embeddedConfig: OpenCodeAgentConfig = {
  model: "anthropic/claude-opus-4-6",
  providerOptions: {
    hostname: "127.0.0.1",
    port: 4096,
    timeout: 10_000,
  },
};

const agent = createAgent(config);
```

### `OpenCodeProviderOptions` Fields

| Field | Type | Description |
|---|---|---|
| `baseUrl` | `string` | Base URL of a running OpenCode server. When set, connects in client-only mode. Omit to start an embedded server. |
| `hostname` | `string` | Hostname for the embedded server (default: `"127.0.0.1"`). Ignored in client-only mode. |
| `port` | `number` | Port for the embedded server (default: `4096`). Ignored in client-only mode. |
| `timeout` | `number` | Startup timeout in milliseconds for the embedded server (default: `5000`). |
| `agent` | `string` | OpenCode agent name to use (e.g., `"coder"`). |
| `providerID` | `string` | Override the provider parsed from `model` (e.g., `"vertex"`, `"openai"`). |
| `modelID` | `string` | Override the model ID parsed from `model`. |

### Model Format

OpenCode identifies models as `"providerID/modelID"` pairs. Set `config.model` to this format:

```typescript
model: "anthropic/claude-opus-4-6"     // providerID: "anthropic", modelID: "claude-opus-4-6"
model: "openai/gpt-4o"                  // providerID: "openai",    modelID: "gpt-4o"
model: "claude-opus-4-6"                // no providerID, modelID: "claude-opus-4-6"
```

Use `providerOptions.providerID` and `providerOptions.modelID` to override the parsed values.

---

## Permission Policy Mapping

`OmniPermissionPolicy` is a cross-provider abstraction. Each provider maps it to its native setting. The table below shows what the preset strings correspond to in each SDK.

| `OmniPermissionPolicy` | Claude (`permissionMode`) | Codex (`approvalPolicy`) | OpenCode |
|---|---|---|---|
| `"auto-approve"` | `"bypassPermissions"` | `"never"` | No native mapping |
| `"approve-edits"` | `"acceptEdits"` | `"on-request"` | No native mapping |
| `"ask"` | `"default"` | `"untrusted"` | No native mapping |
| `"plan-only"` | `"plan"` | — | No native mapping |
| `{ canUseTool }` | Custom function per request | Custom function per request | Not supported |

OpenCode does not expose a tool approval API — it manages tool permissions internally. The `permissions` field in `OmniAgentConfig` is accepted for compatibility but has no effect on OpenCode sessions.

If you set both `permissions` in `OmniAgentConfig` and a native policy in `providerOptions`, the native value takes precedence. Pick one or the other to avoid confusion.

See `examples/provider-specific.ts` for runnable examples of all three providers.
