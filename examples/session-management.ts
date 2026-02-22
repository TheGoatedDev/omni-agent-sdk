/**
 * session-management.ts — resume sessions by ID and list active sessions
 *
 * Sessions are long-lived objects with an .id you can persist.  Use
 * agent.resumeSession(id) to reconnect to an existing conversation later.
 * agent.listSessions() (optional — not all providers implement it) returns
 * a summary of all sessions created by this agent instance.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/session-management.ts
 *   OPENAI_API_KEY=sk-...   npx tsx examples/session-management.ts codex
 */

import { createProviderAgent, printUsage } from "./_helpers.js";

const agent = await createProviderAgent();

// ---------------------------------------------------------------------------
// Step 1: Create a session and do some work
// ---------------------------------------------------------------------------

console.log("=== Step 1: Create initial session ===\n");

const session1 = await agent.createSession({ cwd: process.cwd() });
const sessionId = session1.id;

console.log(`Session ID: ${sessionId}`);

const result1 = await session1.prompt({
	message: "Remember the number 42.  I will ask you about it later.",
});
console.log("Turn 1:", result1.text);
printUsage(result1.usage);

// Dispose the session — in a real app you might store sessionId to a DB here
await session1.dispose();

// ---------------------------------------------------------------------------
// Step 2: Resume the session — conversation context is preserved
// ---------------------------------------------------------------------------

console.log("\n=== Step 2: Resume session ===\n");

const session2 = await agent.resumeSession(sessionId, { cwd: process.cwd() });

console.log(`Resumed session: ${session2.id}`);

const result2 = await session2.prompt({
	message: "What number did I ask you to remember?",
});
console.log("Turn 2:", result2.text);
printUsage(result2.usage);

await session2.dispose();

// ---------------------------------------------------------------------------
// Step 3: List sessions (if the provider supports it)
// ---------------------------------------------------------------------------

console.log("\n=== Step 3: List sessions ===\n");

if (agent.listSessions) {
	const sessions = await agent.listSessions();
	console.log(`Found ${sessions.length} session(s):`);
	for (const s of sessions) {
		const created = s.createdAt ? s.createdAt.toISOString() : "unknown";
		console.log(`  ${s.id}  (created: ${created})`);
	}
} else {
	console.log(`Provider "${agent.provider}" does not implement listSessions().`);
}

await agent.dispose();
