# One interface for AI coding agents

One call pattern, any provider. This SDK wraps AI coding agent SDKs behind a shared TypeScript API — write your session code once, swap providers by changing an import.

Currently ships with Claude, Codex, and OpenCode adapters.

## Install

```bash
# Claude provider
npm install @omni-agent-sdk/provider-claude @anthropic-ai/claude-agent-sdk

# Codex provider
npm install @omni-agent-sdk/provider-codex @openai/codex-sdk

# OpenCode provider
npm install @omni-agent-sdk/provider-opencode @opencode-ai/sdk

# Core types and AgentManager only (no provider required)
npm install @omni-agent-sdk/core
```

## Quick Start

**Claude**

```typescript
import { createAgent } from "@omni-agent-sdk/provider-claude";

const agent = createAgent({
  model: "claude-opus-4-6",
  permissions: "auto-approve",
});

const session = await agent.createSession({ cwd: process.cwd() });
const result = await session.prompt({ message: "What is a monorepo?" });
console.log(result.text);

await session.dispose();
await agent.dispose();
```

Set `ANTHROPIC_API_KEY` before running.

**Codex**

```typescript
import { createAgent } from "@omni-agent-sdk/provider-codex";

const agent = createAgent({
  model: "o3",
  permissions: "auto-approve",
});

const session = await agent.createSession({ cwd: process.cwd() });
const result = await session.prompt({ message: "What is a monorepo?" });
console.log(result.text);

await session.dispose();
await agent.dispose();
```

Set `OPENAI_API_KEY` before running.

**OpenCode**

```typescript
import { createAgent } from "@omni-agent-sdk/provider-opencode";

const agent = createAgent({
  model: "anthropic/claude-opus-4-6",
  providerOptions: {
    baseUrl: "http://localhost:4096", // connect to a running OpenCode server
  },
});

const session = await agent.createSession({ cwd: process.cwd() });
const result = await session.prompt({ message: "What is a monorepo?" });
console.log(result.text);

await session.dispose();
await agent.dispose();
```

Omit `baseUrl` to start an embedded OpenCode server automatically.

## Packages

| Package | What it does | Install |
|---|---|---|
| `@omni-agent-sdk/core` | Shared interfaces, error classes, `AgentManager` | `npm install @omni-agent-sdk/core` |
| `@omni-agent-sdk/provider-claude` | Claude Agent SDK adapter | `npm install @omni-agent-sdk/provider-claude @anthropic-ai/claude-agent-sdk` |
| `@omni-agent-sdk/provider-codex` | OpenAI Codex SDK adapter | `npm install @omni-agent-sdk/provider-codex @openai/codex-sdk` |
| `@omni-agent-sdk/provider-opencode` | OpenCode SDK adapter (REST + SSE) | `npm install @omni-agent-sdk/provider-opencode @opencode-ai/sdk` |

## Core Concepts

**Agent** — A configured connection to one AI provider. Created via `createAgent()`, it holds your model and permission settings. See [API Reference](docs/api-reference.md#omniagent).

**Session** — A single conversation thread. The provider tracks message history within it. Call `agent.createSession()` to start one. See [API Reference](docs/api-reference.md#omnisession).

**Prompt** — One request/response exchange inside a session. Returns a `PromptResult` with the final text, all messages, and token usage. See [Configuration](docs/configuration.md#promptinput).

**AgentManager** — A registry that holds multiple named agents and routes between them. Supports automatic fallback when one provider fails. See [Agent Manager](docs/agent-manager.md).

## API at a Glance

```
createAgent(config)
  └─ OmniAgent
       └─ createSession(options)
              └─ OmniSession
                     ├─ prompt(input)          → Promise<PromptResult>
                     └─ promptStreaming(input)  → OmniStream
                                                    └─ for await (event of stream)
```

## AgentManager

If you're running multiple providers, `AgentManager` gives you a single call site with optional automatic fallback.

```typescript
import { AgentManager } from "@omni-agent-sdk/core";
import { createAgent as createClaudeAgent } from "@omni-agent-sdk/provider-claude";
import { createAgent as createCodexAgent } from "@omni-agent-sdk/provider-codex";

const manager = new AgentManager({
  fallback: { enabled: true, order: ["claude", "codex"] },
});

manager.register("claude", createClaudeAgent({ model: "claude-opus-4-6", permissions: "auto-approve" }));
manager.register("codex", createCodexAgent({ model: "o3", permissions: "auto-approve" }));

// Uses claude by default. Falls back to codex on PROVIDER_ERROR or NETWORK failures.
const session = await manager.createSession({ cwd: process.cwd() });
const result = await session.prompt({ message: "What is a monorepo?" });
console.log(result.text);
```

You can also route to a specific provider with `manager.createSessionOn("codex")`, or read the full details in [Agent Manager](docs/agent-manager.md).

## Documentation

| Guide | Contents |
|---|---|
| [API Reference](docs/api-reference.md) | All exported types, interfaces, and class signatures |
| [Configuration](docs/configuration.md) | Every field on `OmniAgentConfig` and `PromptInput` |
| [Error Handling](docs/error-handling.md) | Error classes, error codes, and catch patterns |
| [Streaming](docs/streaming.md) | `promptStreaming()`, event types, and cancellation |
| [Agent Manager](docs/agent-manager.md) | Multi-provider registry with fallback |
| [Provider Options](docs/provider-options.md) | Claude and Codex provider-specific settings |

## Examples

Runnable scripts live in `examples/`. Each accepts an optional `codex` argument to switch providers:

```bash
ANTHROPIC_API_KEY=sk-... npx tsx examples/basic-prompt.ts
ANTHROPIC_API_KEY=sk-... npx tsx examples/streaming.ts
ANTHROPIC_API_KEY=sk-... npx tsx examples/error-handling.ts
ANTHROPIC_API_KEY=sk-... npx tsx examples/custom-permissions.ts
ANTHROPIC_API_KEY=sk-... npx tsx examples/mcp-servers.ts

# Codex
OPENAI_API_KEY=sk-... npx tsx examples/basic-prompt.ts codex
```

Other examples: `multi-turn.ts`, `session-management.ts`, `abort-signal.ts`, `budget-limits.ts`, `structured-output.ts`, `provider-agnostic.ts`, `provider-specific.ts`.

```bash
# OpenCode (requires a running OpenCode server or omit OPENCODE_BASE_URL for embedded mode)
OPENCODE_BASE_URL=http://localhost:4096 npx tsx examples/basic-prompt.ts opencode
```

## Environment Variables

| Variable | Provider | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude | Yes |
| `OPENAI_API_KEY` | Codex | Yes |
| `OPENCODE_BASE_URL` | OpenCode (client-only mode) | No — omit to use embedded server |

## License

MIT
