/**
 * provider-agnostic.ts — write once, run with any provider
 *
 * By typing parameters as OmniAgent / OmniSession from @omni-agent-sdk/core,
 * your business logic is completely decoupled from Claude or Codex internals.
 * Swap providers by changing the factory call or the PROVIDER env var.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/provider-agnostic.ts
 *   OPENAI_API_KEY=sk-...   npx tsx examples/provider-agnostic.ts codex
 */

import type { OmniAgent, OmniSession, PromptResult } from "@omni-agent-sdk/core";
import { createProviderAgent, printUsage } from "./_helpers.js";

// ---------------------------------------------------------------------------
// Provider-agnostic helper — works with any OmniAgent implementation
// ---------------------------------------------------------------------------

async function summariseFile(session: OmniSession, filePath: string): Promise<PromptResult> {
	return session.prompt({
		message: `Summarise the purpose of the file at ${filePath} in one sentence.`,
	});
}

async function runPipeline(agent: OmniAgent): Promise<void> {
	console.log(`Running pipeline with provider: ${agent.provider}`);

	const session = await agent.createSession({ cwd: process.cwd() });

	try {
		const result = await summariseFile(session, "package.json");
		console.log("Summary:", result.text);
		printUsage(result.usage);
	} finally {
		await session.dispose();
	}
}

// ---------------------------------------------------------------------------
// Entry point — provider chosen at runtime, not at compile time
// ---------------------------------------------------------------------------

const agent = await createProviderAgent();

try {
	await runPipeline(agent);
} finally {
	await agent.dispose();
}
