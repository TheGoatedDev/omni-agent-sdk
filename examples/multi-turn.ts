/**
 * multi-turn.ts — multiple prompts within a single session
 *
 * A session maintains conversation context across multiple prompt() calls.
 * The model remembers what was said earlier in the same session.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/multi-turn.ts
 *   OPENAI_API_KEY=sk-...   npx tsx examples/multi-turn.ts codex
 */

import { createProviderAgent, printUsage } from "./_helpers.js";

const agent = await createProviderAgent();
const session = await agent.createSession({ cwd: process.cwd() });

console.log(`Provider: ${agent.provider}  |  Session: ${session.id}\n`);

// Turn 1 — establish context
const turn1 = await session.prompt({
	message: "My name is Alice and I am learning TypeScript.",
});
console.log("Turn 1 →", turn1.text);
printUsage(turn1.usage);
console.log();

// Turn 2 — the model should recall "Alice" and "TypeScript"
const turn2 = await session.prompt({
	message: "What is my name and what am I learning?",
});
console.log("Turn 2 →", turn2.text);
printUsage(turn2.usage);
console.log();

// Turn 3 — follow-up question building on the established context
const turn3 = await session.prompt({
	message: "Give me one beginner tip for what I am learning.",
});
console.log("Turn 3 →", turn3.text);
printUsage(turn3.usage);

await session.dispose();
await agent.dispose();
