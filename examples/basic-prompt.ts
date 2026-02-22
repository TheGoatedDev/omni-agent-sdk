/**
 * basic-prompt.ts — simplest possible usage
 *
 * Creates an agent, opens a session, sends one prompt, prints the response.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/basic-prompt.ts
 *   OPENAI_API_KEY=sk-...   npx tsx examples/basic-prompt.ts codex
 */

import { createProviderAgent, printUsage } from "./_helpers.js";

const agent = await createProviderAgent();
const session = await agent.createSession({ cwd: process.cwd() });

console.log(`Provider : ${agent.provider}`);
console.log(`Session  : ${session.id}`);
console.log("─".repeat(60));

const result = await session.prompt({
	message: "Explain what a monorepo is in two sentences.",
});

console.log(result.text);
console.log("─".repeat(60));
printUsage(result.usage);

await session.dispose();
await agent.dispose();
