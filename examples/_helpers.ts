/**
 * Shared utilities used across all examples.
 *
 * - requireEnv       — read a required environment variable or throw
 * - resolveProvider  — pick "claude" | "codex" from CLI arg or $PROVIDER
 * - createProviderAgent — dynamically import and create the selected provider
 * - printEvent       — pretty-print a single OmniEvent to stdout
 * - printUsage       — print token/cost/timing summary
 */

import type { OmniAgent, OmniAgentConfig, OmniEvent, OmniUsage } from "@omni-agent-sdk/core";
import type { ClaudeAgentConfig } from "@omni-agent-sdk/provider-claude";
import type { CodexAgentConfig } from "@omni-agent-sdk/provider-codex";
import type { OpenCodeAgentConfig } from "@omni-agent-sdk/provider-opencode";

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

/** Retrieve an environment variable, or throw if it is absent. */
export function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(
			`Missing required environment variable: ${name}\n` +
				`Set it with: export ${name}=your-value-here`,
		);
	}
	return value;
}

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

/**
 * Resolve the provider name from:
 *   1. First CLI argument  (e.g. `npx tsx basic-prompt.ts codex`)
 *   2. PROVIDER env var    (e.g. `PROVIDER=codex npx tsx basic-prompt.ts`)
 *   3. Default: "claude"
 */
export function resolveProvider(): "claude" | "codex" | "opencode" {
	const raw = process.argv[2] ?? process.env.PROVIDER ?? "claude";
	if (raw === "claude" || raw === "codex" || raw === "opencode") return raw;
	throw new Error(`Unknown provider "${raw}". Use "claude", "codex", or "opencode".`);
}

// ---------------------------------------------------------------------------
// Agent factory
// ---------------------------------------------------------------------------

/**
 * Dynamically import the selected provider package and return an OmniAgent.
 *
 * Using dynamic imports means only the selected provider's module is loaded,
 * so you don't pay the startup cost of both SDKs when running a single example.
 */
export async function createProviderAgent(config: OmniAgentConfig = {}): Promise<OmniAgent> {
	const provider = resolveProvider();

	if (provider === "claude") {
		const mod = await import("@omni-agent-sdk/provider-claude");
		return mod.createAgent({ permissions: "auto-approve", ...config } as ClaudeAgentConfig);
	}

	if (provider === "opencode") {
		const mod = await import("@omni-agent-sdk/provider-opencode");
		return mod.createAgent({ ...config } as OpenCodeAgentConfig);
	}

	const mod = await import("@omni-agent-sdk/provider-codex");
	return mod.createAgent({ permissions: "auto-approve", ...config } as CodexAgentConfig);
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Pretty-print a single OmniEvent.  text_delta is written inline; other
 *  events print on their own line so the streaming output remains readable. */
export function printEvent(event: OmniEvent): void {
	switch (event.type) {
		case "text_delta":
			process.stdout.write(event.text);
			break;
		case "tool_start":
			console.log(`\n[tool_start] ${event.toolName} (id=${event.toolId})`);
			break;
		case "tool_end":
			console.log(`[tool_end]   id=${event.toolId} ${event.isError ? "ERROR" : "ok"}`);
			break;
		case "turn_start":
			console.log("\n[turn_start]");
			break;
		case "turn_end":
			console.log("\n[turn_end]");
			if (event.usage) printUsage(event.usage);
			break;
		case "message_start":
			console.log(`\n[message_start] role=${event.role}`);
			break;
		case "message_end":
			console.log(`[message_end]   id=${event.message.id}`);
			break;
		case "error":
			console.error(`[error] ${event.error.code}: ${event.error.message}`);
			break;
	}
}

/** Print a one-line token / cost / timing summary. */
export function printUsage(usage: OmniUsage): void {
	const parts: string[] = [];
	if (usage.tokens) {
		parts.push(`tokens: ${usage.tokens.input} in / ${usage.tokens.output} out`);
	}
	if (usage.totalCostUsd !== undefined) {
		parts.push(`cost: $${usage.totalCostUsd.toFixed(6)}`);
	}
	if (usage.durationMs !== undefined) {
		parts.push(`time: ${usage.durationMs}ms`);
	}
	if (usage.numTurns !== undefined) {
		parts.push(`agentic_turns: ${usage.numTurns}`);
	}
	if (parts.length > 0) {
		console.log(`[usage] ${parts.join(" | ")}`);
	}
}
