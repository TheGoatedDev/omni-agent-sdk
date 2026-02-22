/**
 * budget-limits.ts — maxBudgetUsd and maxTurns controls
 *
 * Budget limits can be set at two levels:
 *   - Agent config  (applies to every session / prompt on this agent)
 *   - PromptInput   (overrides for a single prompt call)
 *
 * When a limit is exceeded the provider throws BudgetExceededError (for cost)
 * or OmniAgentError with code "TURN_LIMIT" (for turns).
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/budget-limits.ts
 *   OPENAI_API_KEY=sk-...   npx tsx examples/budget-limits.ts codex
 */

import { BudgetExceededError, OmniAgentError } from "@omni-agent-sdk/core";
import { createProviderAgent, printUsage } from "./_helpers.js";

// ---------------------------------------------------------------------------
// Example 1: Agent-level budget  ($0.10 max for entire agent lifetime)
// ---------------------------------------------------------------------------

console.log("=== Example 1: Agent-level budget ($0.10) ===\n");

{
	const agent = await createProviderAgent({
		maxBudgetUsd: 0.1,
		maxTurns: 10,
	});
	const session = await agent.createSession({ cwd: process.cwd() });

	try {
		const result = await session.prompt({
			message: "What is the capital of France?",
		});
		console.log(result.text);
		printUsage(result.usage);
	} catch (err) {
		if (err instanceof BudgetExceededError) {
			console.log("Agent-level budget exceeded:", err.message);
		} else {
			throw err;
		}
	} finally {
		await session.dispose();
		await agent.dispose();
	}
}

// ---------------------------------------------------------------------------
// Example 2: Per-prompt budget override
// ---------------------------------------------------------------------------

console.log("\n=== Example 2: Per-prompt budget override ($0.001) ===\n");

{
	// Agent has a generous limit; individual prompt is very tight
	const agent = await createProviderAgent({ maxBudgetUsd: 1.0 });
	const session = await agent.createSession({ cwd: process.cwd() });

	try {
		const result = await session.prompt({
			message: "Summarise the entire works of Shakespeare.",
			maxBudgetUsd: 0.001, // very tight — likely to trigger on large models
		});
		console.log(result.text.slice(0, 300));
		printUsage(result.usage);
	} catch (err) {
		if (err instanceof BudgetExceededError) {
			console.log("Per-prompt budget exceeded:", err.message);
		} else {
			throw err;
		}
	} finally {
		await session.dispose();
		await agent.dispose();
	}
}

// ---------------------------------------------------------------------------
// Example 3: maxTurns — limits agentic tool-call loops
// ---------------------------------------------------------------------------

console.log("\n=== Example 3: maxTurns: 1 ===\n");

{
	const agent = await createProviderAgent();
	const session = await agent.createSession({ cwd: process.cwd() });

	try {
		const result = await session.prompt({
			message: "What is 2 + 2?",
			maxTurns: 1,
		});
		console.log(result.text);
		printUsage(result.usage);
	} catch (err) {
		if (err instanceof OmniAgentError && err.code === "TURN_LIMIT") {
			console.log("Turn limit reached:", err.message);
		} else {
			throw err;
		}
	} finally {
		await session.dispose();
		await agent.dispose();
	}
}
