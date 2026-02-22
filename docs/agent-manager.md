# Agent Manager

`AgentManager` holds a registry of named agents and routes calls between them. It implements `OmniAgent`, so you can use it anywhere a single agent is expected.

The two main reasons to use it: maintain multiple providers at a single call site, or configure automatic fallback so a second provider takes over when the first fails.

---

## Setup

```typescript
import { AgentManager } from "@omni-agent-sdk/core";
import { createAgent as createClaudeAgent } from "@omni-agent-sdk/provider-claude";
import { createAgent as createCodexAgent } from "@omni-agent-sdk/provider-codex";

const manager = new AgentManager();

manager.register("claude", createClaudeAgent({
  model: "claude-opus-4-6",
  permissions: "auto-approve",
}));

manager.register("codex", createCodexAgent({
  model: "o3",
  permissions: "auto-approve",
}));
```

The first registered agent becomes the default. Calls to `manager.createSession()` route to it unless you change the default or route explicitly.

---

## Registry API

| Method | Returns | Description |
|---|---|---|
| `register(name, agent)` | `this` | Add an agent. Returns `this` for chaining. |
| `unregister(name)` | `boolean` | Remove an agent. Returns `true` if it existed. |
| `agent(name)` | `OmniAgent` | Get an agent by name. Throws `AgentNotFoundError` if missing. |
| `tryAgent(name)` | `OmniAgent \| undefined` | Get an agent by name without throwing. |
| `has(name)` | `boolean` | Check whether an agent is registered. |
| `agentNames()` | `readonly string[]` | All registered names in registration order. |
| `size` | `number` | Number of registered agents. |

---

## Default Agent

The first registered agent is automatically the default. Any call to `manager.createSession()` routes to it.

Change the default at any time:

```typescript
manager.defaultAgentName = "codex"; // codex is now default
```

Reading the current default:

```typescript
console.log(manager.defaultAgentName); // "claude"
```

Setting `defaultAgentName` to a name that isn't registered throws `AgentNotFoundError`.

---

## Explicit Routing

Route a session to a specific agent without changing the default:

```typescript
const session = await manager.createSessionOn("codex", {
  cwd: process.cwd(),
});
```

Session IDs are provider-specific, so `resumeSession()` always routes to the current default agent. If you need to resume a session from a specific provider, get the agent directly: `manager.agent("claude").resumeSession(id)`.

---

## Fallback

Enable fallback so the manager automatically tries the next agent when one fails.

```typescript
const manager = new AgentManager({
  fallback: {
    enabled: true,
    order: ["claude", "codex"], // try claude first, then codex
  },
});

manager.register("claude", claudeAgent);
manager.register("codex", codexAgent);
```

### `FallbackConfig` Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | — | Must be `true` to activate fallback. |
| `order` | `string[]` | Registration order | Which agents to try, and in what order. Names not in the registry are skipped silently. |
| `shouldFallback` | `(err: OmniAgentError) => boolean` | Falls back on `PROVIDER_ERROR` and `NETWORK` | Return `true` to try the next agent, `false` to rethrow immediately. |

By default, only `PROVIDER_ERROR` and `NETWORK` errors trigger a fallback. Errors like `BUDGET_EXCEEDED`, `TURN_LIMIT`, and `ABORT` are rethrown immediately.

### `AllAgentsFailedError`

If every agent in the fallback order fails, an `AllAgentsFailedError` is thrown. Its `errors` array has one entry per failed agent:

```typescript
import { AllAgentsFailedError } from "@omni-agent-sdk/core";

try {
  const session = await manager.createSession();
} catch (err) {
  if (err instanceof AllAgentsFailedError) {
    for (const { agentName, error } of err.errors) {
      console.error(`${agentName}: ${error.message}`);
    }
  }
}
```

### Generic Fallback

`withFallback` runs any async function with fallback behavior — not just `createSession()`:

```typescript
const result = await manager.withFallback(
  (agent) => agent.createSession({ cwd: process.cwd() }),
  ["claude", "codex"] // optional order override
);
```

---

## Disposal

`dispose()` calls `dispose()` on every registered agent, clears the registry, and resets the default. Errors from individual agents are swallowed so one bad dispose doesn't block the others. The method is idempotent — calling it twice is safe.

```typescript
await manager.dispose();
// All agents are gone, manager is empty
```
