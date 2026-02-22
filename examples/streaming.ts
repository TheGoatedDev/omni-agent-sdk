/**
 * streaming.ts — real-time event iteration via promptStreaming()
 *
 * OmniStream is an async iterable of OmniEvent objects.  Iterating it gives
 * you each event as it arrives so you can stream output to the terminal,
 * display tool-use in real time, or track cost after each turn.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/streaming.ts
 *   OPENAI_API_KEY=sk-...   npx tsx examples/streaming.ts codex
 */

import { createProviderAgent, printEvent } from "./_helpers.js";

const agent = await createProviderAgent();
const session = await agent.createSession({ cwd: process.cwd() });

console.log(`Streaming from provider: ${agent.provider}\n`);

// promptStreaming() returns an OmniStream — an AsyncDisposable async iterable.
// Use `await using` (ES2022 explicit resource management) so the stream is
// automatically cleaned up when the block exits, even on error.
await using stream = session.promptStreaming({
	message: "Count from 1 to 5, pausing briefly between each number.",
});

for await (const event of stream) {
	printEvent(event);
}

// stream.result() is also available if you want the full PromptResult after
// iterating: const result = await stream.result();

console.log("\n─".repeat(30));
console.log("Stream complete.");

await session.dispose();
await agent.dispose();
