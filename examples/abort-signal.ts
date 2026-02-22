/**
 * abort-signal.ts — cancellation via AbortController and session.abort()
 *
 * Two cancellation mechanisms are available:
 *   1. AbortSignal passed to prompt() / promptStreaming() — standard Web API
 *   2. session.abort() — imperative cancel from outside the prompt call
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/abort-signal.ts
 *   OPENAI_API_KEY=sk-...   npx tsx examples/abort-signal.ts codex
 */

import { AbortError } from "@omni-agent-sdk/core";
import { createProviderAgent } from "./_helpers.js";

const agent = await createProviderAgent();

// ---------------------------------------------------------------------------
// Example 1: AbortSignal timeout on a single prompt
// ---------------------------------------------------------------------------

console.log("=== Example 1: AbortSignal (5 s timeout) ===\n");

{
	const session = await agent.createSession({ cwd: process.cwd() });
	const controller = new AbortController();

	// Abort after 5 seconds — in a real app this could be a user-cancel button
	const timeout = setTimeout(() => {
		console.log("\nTimeout reached — aborting...");
		controller.abort();
	}, 5_000);

	try {
		const result = await session.prompt({
			message: "Write a detailed essay on the history of computing.",
			signal: controller.signal,
		});
		clearTimeout(timeout);
		console.log("Completed before timeout:", result.text.slice(0, 200), "...");
	} catch (err) {
		clearTimeout(timeout);
		if (err instanceof AbortError) {
			console.log("Caught AbortError — prompt was cancelled as expected.");
		} else {
			throw err;
		}
	} finally {
		await session.dispose();
	}
}

// ---------------------------------------------------------------------------
// Example 2: session.abort() from a parallel task
// ---------------------------------------------------------------------------

console.log("\n=== Example 2: session.abort() after 3 s ===\n");

{
	const session = await agent.createSession({ cwd: process.cwd() });

	// Fire abort from a parallel setTimeout
	const abortTimer = setTimeout(() => {
		console.log("\nCalling session.abort()...");
		void session.abort();
	}, 3_000);

	try {
		const result = await session.prompt({
			message: "Generate an exhaustive list of all world capitals.",
		});
		clearTimeout(abortTimer);
		console.log("Completed:", result.text.slice(0, 200));
	} catch (err) {
		clearTimeout(abortTimer);
		if (err instanceof AbortError) {
			console.log("Caught AbortError from session.abort().");
		} else {
			throw err;
		}
	} finally {
		await session.dispose();
	}
}

await agent.dispose();
