# Streaming

`promptStreaming()` returns an `OmniStream` — an async iterable of `OmniEvent` objects. Events arrive as the provider generates them, so you can print text as it streams, react to tool calls in real time, and track usage after each turn.

---

## Basic Usage

```typescript
await using stream = session.promptStreaming({
  message: "Count from 1 to 5.",
});

for await (const event of stream) {
  if (event.type === "text_delta") {
    process.stdout.write(event.text);
  }
}
```

`await using` is ES2022 explicit resource management. It calls `stream[Symbol.asyncDispose]()` when the block exits, including on error. If your runtime doesn't support it yet, call `await stream.abort()` in a `finally` block instead.

---

## Event Types

| Type | Fields | When it fires |
|---|---|---|
| `text_delta` | `text: string` | A chunk of generated text. |
| `tool_start` | `toolName`, `toolId`, `input?` | The agent is about to call a tool. |
| `tool_end` | `toolId`, `output?`, `isError` | A tool call completed (or failed). |
| `message_start` | `role: "assistant" \| "system"` | A new message has started. |
| `message_end` | `message: OmniMessage` | A message completed — the full `OmniMessage` is attached. |
| `turn_start` | — | An agentic turn has started. |
| `turn_end` | `usage?: OmniUsage` | A turn finished. Usage is available if the provider reports it. |
| `error` | `error: OmniAgentError` | The provider reported an error mid-stream. |

---

## Getting the Final Result

After iterating, call `stream.result()` to get the same `PromptResult` you'd receive from `prompt()`:

```typescript
await using stream = session.promptStreaming({ message: "Hello" });

for await (const event of stream) {
  // process events
}

const result = await stream.result();
console.log(result.text);
console.log(`Tokens: ${result.usage.tokens?.total}`);
```

You can also skip iteration and call `result()` directly. It will consume the stream internally and return when the response is complete.

---

## Aborting

Two ways to stop a stream early.

**`AbortSignal`** — pass a signal to `promptStreaming()`:

```typescript
import { AbortError } from "@omni-agent-sdk/core";

const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

await using stream = session.promptStreaming({
  message: "Write a long essay.",
  signal: controller.signal,
});

try {
  for await (const event of stream) {
    // ...
  }
} catch (err) {
  if (err instanceof AbortError) {
    console.log("Stream was aborted.");
  }
}
```

**`stream.abort()`** — call it from outside the iteration:

```typescript
await using stream = session.promptStreaming({ message: "..." });

setTimeout(() => void stream.abort(), 3_000);

for await (const event of stream) {
  // iteration will stop when abort() resolves
}
```

See `examples/abort-signal.ts` for both patterns with full error handling.

---

## `OmniStream` Interface

```typescript
interface OmniStream extends AsyncDisposable {
  [Symbol.asyncIterator](): AsyncIterator<OmniEvent>;
  result(): Promise<PromptResult>;
  abort(): Promise<void>;
}
```

`OmniStream` extends `AsyncDisposable` — use `await using` for automatic cleanup, or call `abort()` in a `finally` block when working in environments that don't support explicit resource management yet.

See `examples/streaming.ts` for a complete runnable example.
