# omni-agent-sdk examples

Runnable TypeScript examples that demonstrate the omni-agent-sdk API.
Each file is self-contained and executable with `tsx` — no build step required.

## Prerequisites

```bash
# Install workspace deps (run from the repo root)
pnpm install
```

You need at least one provider API key in your environment:

| Provider | Key variable |
| -------- | ------------ |
| Claude   | `ANTHROPIC_API_KEY` |
| Codex    | `OPENAI_API_KEY` |

## Running examples

```bash
# Claude (default)
ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/basic-prompt.ts

# Codex
OPENAI_API_KEY=sk-...      npx tsx examples/basic-prompt.ts codex

# Or set provider via env var
PROVIDER=codex OPENAI_API_KEY=sk-... npx tsx examples/basic-prompt.ts
```

## Index

### Essential

| File | What it shows |
| ---- | ------------- |
| [`basic-prompt.ts`](./basic-prompt.ts) | Create agent → session → prompt → print |
| [`streaming.ts`](./streaming.ts) | Real-time `OmniEvent` iteration via `promptStreaming()` |
| [`multi-turn.ts`](./multi-turn.ts) | Multiple prompts in one session (conversation memory) |
| [`provider-agnostic.ts`](./provider-agnostic.ts) | Type as `OmniAgent`/`OmniSession`, swap providers at runtime |

### Intermediate

| File | What it shows |
| ---- | ------------- |
| [`error-handling.ts`](./error-handling.ts) | `OmniAgentError`, `AbortError`, `BudgetExceededError`, `err.code` |
| [`abort-signal.ts`](./abort-signal.ts) | `AbortController` on `prompt()` and `session.abort()` |
| [`budget-limits.ts`](./budget-limits.ts) | `maxBudgetUsd` + `maxTurns` at agent and prompt level |
| [`custom-permissions.ts`](./custom-permissions.ts) | `OmniPermissionPolicy` with `canUseTool` callback |

### Advanced

| File | What it shows |
| ---- | ------------- |
| [`structured-output.ts`](./structured-output.ts) | `outputSchema` (JSON Schema) for typed responses |
| [`mcp-servers.ts`](./mcp-servers.ts) | MCP server config (stdio + URL) |
| [`session-management.ts`](./session-management.ts) | Resume sessions by ID, `listSessions()` |
| [`provider-specific.ts`](./provider-specific.ts) | `providerOptions` for Claude and Codex-specific features |

## Type-checking

```bash
# From the repo root — builds providers first, then type-checks examples
pnpm check

# Or check examples only (requires providers already built)
cd examples && npx tsc --noEmit
```

## Shared helpers (`_helpers.ts`)

All examples import from `_helpers.ts` for common utilities:

| Export | Purpose |
| ------ | ------- |
| `requireEnv(name)` | Read a required env var or throw with a clear message |
| `resolveProvider()` | Pick `"claude"` or `"codex"` from CLI arg / `$PROVIDER` / default |
| `createProviderAgent(config?)` | Dynamically import and create the selected provider |
| `printEvent(event)` | Pretty-print a single `OmniEvent` to stdout |
| `printUsage(usage)` | Print token/cost/timing summary |
