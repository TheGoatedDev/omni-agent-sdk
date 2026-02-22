# Error Handling

## Error Hierarchy

```
Error
└── OmniAgentError
    ├── AbortError
    ├── BudgetExceededError
    ├── AgentNotFoundError       (AgentManager only)
    ├── NoDefaultAgentError      (AgentManager only)
    └── AllAgentsFailedError     (AgentManager only)
```

All error classes are exported from `@omni-agent-sdk/core`.

---

## `OmniAgentError` Properties

| Property | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable error description. |
| `code` | `OmniErrorCode` | Discriminant for programmatic handling. |
| `provider` | `string` | Which provider threw — e.g., `"claude"`, `"codex"`, or `"manager"`. |
| `raw` | `unknown` | The raw error from the underlying SDK, if available. |
| `cause` | `Error` | Standard `Error.cause` — the original error, when applicable. |

---

## Error Codes

| Code | Thrown by | Meaning |
|---|---|---|
| `"ABORT"` | `AbortError` | The operation was cancelled via `AbortSignal` or `session.abort()`. |
| `"BUDGET_EXCEEDED"` | `BudgetExceededError` | Cost hit `maxBudgetUsd`. |
| `"TURN_LIMIT"` | `OmniAgentError` | The prompt hit `maxTurns`. |
| `"PERMISSION_DENIED"` | `OmniAgentError` | A tool call was denied by the permission policy. |
| `"SESSION_NOT_FOUND"` | `OmniAgentError` | `resumeSession()` was called with an ID the provider doesn't recognize. |
| `"PROVIDER_ERROR"` | `OmniAgentError` | The underlying provider returned an error not covered by another code. |
| `"CONFIGURATION"` | `OmniAgentError` | Bad config — missing required field, unknown agent name in the registry, etc. |
| `"NETWORK"` | `OmniAgentError` | Network failure reaching the provider's API. |
| `"UNKNOWN"` | `OmniAgentError` | An error that doesn't fit any other category. |

---

## Catch Patterns

Check the most specific subclasses first, then branch on `err.code` for the base class.

```typescript
import { AbortError, BudgetExceededError, OmniAgentError } from "@omni-agent-sdk/core";

try {
  const result = await session.prompt({ message: "Write a novel." });
  console.log(result.text);
} catch (err) {
  // Most specific subclasses first
  if (err instanceof AbortError) {
    console.error("Cancelled.");
    return;
  }

  if (err instanceof BudgetExceededError) {
    console.error(`Spent too much (provider: ${err.provider}).`);
    return;
  }

  // Base class — use err.code for programmatic branching
  if (err instanceof OmniAgentError) {
    switch (err.code) {
      case "TURN_LIMIT":
        console.error("Too many turns.");
        break;
      case "PERMISSION_DENIED":
        console.error("A tool was blocked.");
        break;
      case "SESSION_NOT_FOUND":
        console.error("Session ID is no longer valid.");
        break;
      case "NETWORK":
        console.error(`Network error: ${err.message}`);
        break;
      case "PROVIDER_ERROR":
        console.error(`Provider error: ${err.message}`);
        break;
      default:
        console.error(`Error [${err.code}]: ${err.message}`);
    }
    return;
  }

  throw err; // not an SDK error — let it propagate
}
```

See `examples/error-handling.ts` for a runnable demo including an intentional `TURN_LIMIT` trigger.
