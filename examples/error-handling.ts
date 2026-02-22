/**
 * error-handling.ts — typed error classes, error codes, instanceof patterns
 *
 * OmniAgentError is the base error class.  Subclasses AbortError and
 * BudgetExceededError carry a strongly-typed .code discriminant that lets
 * you handle specific failure modes without string matching.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/error-handling.ts
 *   OPENAI_API_KEY=sk-...   npx tsx examples/error-handling.ts codex
 */

import { AbortError, BudgetExceededError, OmniAgentError } from "@omni-agent-sdk/core";
import { createProviderAgent } from "./_helpers.js";

// ---------------------------------------------------------------------------
// Helper that shows how to handle each error type
// ---------------------------------------------------------------------------

function handleError(err: unknown): void {
	// Most specific subclasses first
	if (err instanceof AbortError) {
		console.error(`[AbortError] Operation was cancelled (provider: ${err.provider})`);
		return;
	}

	if (err instanceof BudgetExceededError) {
		console.error(`[BudgetExceededError] Cost limit hit (provider: ${err.provider})`);
		return;
	}

	// Base class — use err.code for programmatic branching
	if (err instanceof OmniAgentError) {
		switch (err.code) {
			case "TURN_LIMIT":
				console.error(`[OmniAgentError] Too many turns (provider: ${err.provider})`);
				break;
			case "PERMISSION_DENIED":
				console.error(`[OmniAgentError] Tool use denied (provider: ${err.provider})`);
				break;
			case "SESSION_NOT_FOUND":
				console.error(`[OmniAgentError] Session ID not found (provider: ${err.provider})`);
				break;
			case "CONFIGURATION":
				console.error(`[OmniAgentError] Bad config: ${err.message}`);
				break;
			case "NETWORK":
				console.error(`[OmniAgentError] Network failure: ${err.message}`);
				break;
			case "PROVIDER_ERROR":
				console.error(`[OmniAgentError] Provider error: ${err.message}`);
				break;
			default:
				console.error(`[OmniAgentError] Unknown error (code=${err.code}): ${err.message}`);
		}
		return;
	}

	// Non-SDK error — unexpected, re-throw
	throw err;
}

// ---------------------------------------------------------------------------
// Demo: trigger an intentional TURN_LIMIT error
// ---------------------------------------------------------------------------

const agent = await createProviderAgent();
const session = await agent.createSession({ cwd: process.cwd() });

try {
	// maxTurns: 1 means the agent gets exactly one turn.
	// A complex task that requires multiple tool calls will hit TURN_LIMIT.
	await session.prompt({
		message: "What is 1+1?",
		maxTurns: 1,
	});
	console.log("Prompt completed (no error for this simple task).");
} catch (err) {
	handleError(err);
} finally {
	await session.dispose();
	await agent.dispose();
}
