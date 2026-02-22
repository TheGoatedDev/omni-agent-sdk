# Configuration

## `OmniAgentConfig`

Pass this to `createAgent()`. All fields are optional.

| Field | Type | Description |
|---|---|---|
| `model` | `string` | Model identifier. Claude example: `"claude-opus-4-6"`. Codex example: `"o3"`. |
| `permissions` | `OmniPermissionPolicy` | Controls which tools the agent can use. See [Permission Policies](#permission-policies). |
| `cwd` | `string` | Working directory for file operations. Can be overridden per session. |
| `systemPrompt` | `string` | Prefix prepended to every conversation in this agent. |
| `maxBudgetUsd` | `number` | Maximum spend in USD. Throws `BudgetExceededError` if exceeded. |
| `maxTurns` | `number` | Maximum agentic turns per prompt. Throws with code `"TURN_LIMIT"` if exceeded. |
| `tools.allowed` | `string[]` | Allowlist of tool names the agent may use. |
| `tools.disallowed` | `string[]` | Blocklist of tool names the agent may not use. |
| `mcpServers` | `Record<string, OmniMcpServerConfig>` | MCP servers to register. See [MCP Servers](#mcp-servers). |
| `env` | `Record<string, string>` | Additional environment variables passed to the underlying process. |
| `providerOptions` | `Record<string, unknown>` | Provider-specific settings. See [Provider Options](provider-options.md). |

### Example

```typescript
import { createAgent } from "@omni-agent-sdk/provider-claude";

const agent = createAgent({
  model: "claude-opus-4-6",
  permissions: "auto-approve",
  cwd: "/my/project",
  systemPrompt: "You are a senior TypeScript engineer.",
  maxBudgetUsd: 2.00,
  maxTurns: 10,
  tools: { disallowed: ["bash"] },
});
```

---

## Permission Policies

The `permissions` field accepts a string preset or a custom function object.

| Value | Behavior |
|---|---|
| `"auto-approve"` | All tool calls are approved without prompting. |
| `"approve-edits"` | File edits are auto-approved; other tool calls require confirmation. |
| `"ask"` | Every tool call is held for user confirmation. |
| `"plan-only"` | The agent plans but does not execute any tools. |
| `{ canUseTool }` | Your function runs for each tool request. Return `"allow"`, `"deny"`, or `"ask"`. |

### Custom Policy Example

```typescript
import type { OmniPermissionPolicy, ToolPermissionRequest } from "@omni-agent-sdk/core";
import { createAgent } from "@omni-agent-sdk/provider-claude";

const readOnlyPolicy: OmniPermissionPolicy = {
  canUseTool: async (req: ToolPermissionRequest): Promise<"allow" | "deny" | "ask"> => {
    const tool = req.toolName.toLowerCase();

    if (tool === "bash" || tool.includes("write") || tool.includes("delete")) {
      return "deny";
    }

    return "allow";
  },
};

const agent = createAgent({ permissions: readOnlyPolicy });
```

The `ToolPermissionRequest` object has three fields:

- `toolName` — the name of the tool being requested
- `input` — the arguments the agent wants to pass (may be `undefined`)
- `sessionId` — the active session's ID, useful for per-session audit logs

See `examples/custom-permissions.ts` for a full working example with an audit log.

---

## MCP Servers

MCP (Model Context Protocol) servers extend the agent's toolset. Configure them in the `mcpServers` field of `OmniAgentConfig`. Each key is a name you choose; the value is an `OmniMcpServerConfig`.

### `OmniMcpServerConfig`

| Field | Type | Description |
|---|---|---|
| `command` | `string` | Executable for a stdio-based server. |
| `args` | `string[]` | Arguments passed to the process. |
| `env` | `Record<string, string>` | Environment variables for the server process only — not the agent process. |
| `url` | `string` | URL for an HTTP/SSE server. |

Use `command` + `args` + `env` for stdio servers, or `url` for remote servers.

### stdio Server

```typescript
const agent = createAgent({
  mcpServers: {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/my/project"],
      env: { MCP_LOG_LEVEL: "error" },
    },
  },
});
```

### URL Server

```typescript
const agent = createAgent({
  mcpServers: {
    remote: {
      url: "https://my-mcp-host.example.com/sse",
    },
  },
});
```

See `examples/mcp-servers.ts` for a runnable example.

---

## `PromptInput`

Per-prompt options passed to `session.prompt()` or `session.promptStreaming()`. These override the agent-level config for that single call.

| Field | Type | Description |
|---|---|---|
| `message` | `string` | The user message. Required. |
| `model` | `string` | Override the model for this prompt only. |
| `systemPrompt` | `string` | Override the system prompt for this prompt only. |
| `outputSchema` | `JsonSchema` | JSON schema for structured output. Parsed result available in `PromptResult.structuredOutput`. |
| `maxTurns` | `number` | Override the turn limit for this prompt. |
| `maxBudgetUsd` | `number` | Override the budget cap for this prompt. |
| `signal` | `AbortSignal` | Standard Web API signal. Cancel the prompt by calling `controller.abort()`. |
| `providerOptions` | `Record<string, unknown>` | Provider-specific overrides for this prompt. |

### Example

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 30_000);

const result = await session.prompt({
  message: "Summarize the file at src/index.ts.",
  maxTurns: 3,
  signal: controller.signal,
});
```

---

## `CreateSessionOptions`

Passed to `agent.createSession()`. Overrides agent-level settings for this session only.

| Field | Type | Description |
|---|---|---|
| `cwd` | `string` | Working directory. Overrides the agent-level `cwd`. |
| `providerOptions` | `Record<string, unknown>` | Provider-specific options for session creation. |

### Example

```typescript
const session = await agent.createSession({
  cwd: "/my/project",
});
```
