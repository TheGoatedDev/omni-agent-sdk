/**
 * manager-basics.ts — registry operations and explicit routing
 *
 * AgentManager acts as a named registry of OmniAgent instances.
 * You can route sessions to a specific named agent, rely on the auto-default,
 * change the default at runtime, and iterate over all registered agents.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/manager-basics.ts
 */

import { AgentManager } from "@omni-agent-sdk/core";
import { createProviderAgent, printUsage } from "./_helpers.js";

// ---------------------------------------------------------------------------
// Register two independent agent instances under different names.
// First registered becomes the default automatically.
// ---------------------------------------------------------------------------

const agentA = await createProviderAgent();
const agentB = await createProviderAgent();

const manager = new AgentManager();
manager.register("agent-a", agentA);
manager.register("agent-b", agentB);

console.log(`Registered: ${manager.agentNames().join(", ")}`);
console.log(`Default:    ${manager.defaultAgentName}`);
console.log("─".repeat(60));

// ---------------------------------------------------------------------------
// Explicit routing — createSessionOn() sends to a specific named agent
// ---------------------------------------------------------------------------

console.log("\n=== Explicit routing to agent-a ===\n");

const sessionA = await manager.createSessionOn("agent-a", { cwd: process.cwd() });
const resultA = await sessionA.prompt({
	message: 'Reply with exactly: "Hello from agent-a"',
});
console.log(resultA.text);
printUsage(resultA.usage);
await sessionA.dispose();

// ---------------------------------------------------------------------------
// Default routing — createSession() delegates to the current default (agent-a)
// ---------------------------------------------------------------------------

console.log("\n=== Default routing (agent-a) ===\n");

const session1 = await manager.createSession({ cwd: process.cwd() });
const result1 = await session1.prompt({
	message: 'Reply with exactly: "Default agent answered"',
});
console.log(result1.text);
printUsage(result1.usage);
await session1.dispose();

// ---------------------------------------------------------------------------
// Change default at runtime and route again
// ---------------------------------------------------------------------------

manager.defaultAgentName = "agent-b";
console.log(`\nChanged default to: ${manager.defaultAgentName}`);

const session2 = await manager.createSession({ cwd: process.cwd() });
const result2 = await session2.prompt({
	message: 'Reply with exactly: "Now routed to agent-b"',
});
console.log(result2.text);
printUsage(result2.usage);
await session2.dispose();

// ---------------------------------------------------------------------------
// Iterate over all registered agents
// ---------------------------------------------------------------------------

console.log("\n=== All registered agents ===\n");

for (const [name, agent] of manager) {
	console.log(`  ${name}: provider=${agent.provider}`);
}

// dispose() tears down all agents in parallel
await manager.dispose();
console.log(`\nSize after dispose: ${manager.size}`); // 0
