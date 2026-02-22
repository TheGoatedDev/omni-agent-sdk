# AgentManager Examples — Design

**Date:** 2026-02-22
**Status:** Approved

## Goal

Add three example scripts demonstrating `AgentManager` from `@omni-agent-sdk/core`. The existing 12 examples all use single-provider agents; none exercise the manager's registry, routing, or fallback capabilities.

## Files

| File | Focus |
|------|-------|
| `examples/manager-basics.ts` | Registry operations + explicit routing |
| `examples/manager-fallback.ts` | Automatic fallback chain with mock failure |
| `examples/manager-advanced.ts` | `withFallback()` generic helper + dynamic lifecycle |

## Design

### `manager-basics.ts`

Introduces `AgentManager` as a registry and router.

1. Create `AgentManager`, register two agents (`claude` + `codex`)
2. `createSessionOn("claude", …)` — explicit named routing
3. `manager.createSession()` — default agent (first registered)
4. `for (const [name, agent] of manager)` — iterate registered agents
5. `manager.defaultAgentName = "codex"` — change default at runtime
6. `manager.dispose()` — teardown

Run: `ANTHROPIC_API_KEY=sk-... OPENAI_API_KEY=sk-... npx tsx examples/manager-basics.ts`

### `manager-fallback.ts`

Shows automatic provider resilience via the fallback chain.

1. `MockFailingAgent` class wraps a real agent — throws `ProviderError` on first `createSession()`, delegates on subsequent calls
2. Register `MockFailingAgent(claude)` as `"claude"`, real Codex as `"codex"`
3. `AgentManager` configured with `fallback: { enabled: true, order: ["claude", "codex"] }`
4. `manager.createSession()` tries Claude, catches, falls through to Codex automatically
5. Custom `shouldFallback` predicate: fallback on `PROVIDER_ERROR`/`NETWORK` only

Run: `ANTHROPIC_API_KEY=sk-... OPENAI_API_KEY=sk-... npx tsx examples/manager-fallback.ts`

### `manager-advanced.ts`

Covers the remaining surface area.

1. `withFallback(fn, order)` — route any async operation through the fallback machinery
2. Dynamic `register`/`unregister` at runtime
3. `tryAgent(name)` vs `agent(name)` — safe vs throwing lookup
4. `manager.dispose()` — parallel teardown of all agents

Run: `ANTHROPIC_API_KEY=sk-... OPENAI_API_KEY=sk-... npx tsx examples/manager-advanced.ts`

## Constraints

- Use `MockFailingAgent` (not bad API keys) for failure simulation — self-contained, no external dependency
- Follow existing example conventions: JSDoc header, `createProviderAgent` / `printUsage` from `_helpers.ts` where applicable
- Each file must be runnable standalone with `npx tsx examples/<file>.ts`
- TypeScript strict mode; no `as unknown as T` casts
