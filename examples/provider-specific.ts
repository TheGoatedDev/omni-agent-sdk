/**
 * provider-specific.ts — providerOptions for Claude, Codex, and OpenCode features
 *
 * When you need provider-specific features that aren't in OmniAgentConfig,
 * pass them through providerOptions.  Each provider package exports its own
 * typed options interface so you still get autocomplete and type safety.
 *
 * Run (Claude):    ANTHROPIC_API_KEY=sk-... npx tsx examples/provider-specific.ts claude
 * Run (Codex):     OPENAI_API_KEY=sk-...   npx tsx examples/provider-specific.ts codex
 * Run (OpenCode):                          npx tsx examples/provider-specific.ts opencode
 */

import type { ClaudeAgentConfig } from "@omni-agent-sdk/provider-claude";
import type { CodexAgentConfig } from "@omni-agent-sdk/provider-codex";
import type { OpenCodeAgentConfig } from "@omni-agent-sdk/provider-opencode";
import { resolveProvider } from "./_helpers.js";

const provider = resolveProvider();

if (provider === "opencode") {
	// -----------------------------------------------------------------------
	// OpenCode-specific options
	// -----------------------------------------------------------------------
	const { createAgent } = await import("@omni-agent-sdk/provider-opencode");

	const config: OpenCodeAgentConfig = {
		// Model is specified as "providerID/modelID"
		model: "anthropic/claude-opus-4-6",
		providerOptions: {
			// Connect to an existing OpenCode server (client-only mode).
			// Omit baseUrl to start an embedded server automatically.
			baseUrl: "http://127.0.0.1:4096",

			// Override model at the provider level (takes precedence over model string)
			// providerID: "anthropic",
			// modelID: "claude-3-5-sonnet-20241022",

			// OpenCode agent name to use
			// agent: "default",
		},
	};

	const agent = createAgent(config);
	const session = await agent.createSession();

	console.log("OpenCode provider-specific options demo\n");

	const result = await session.prompt({
		message: "What model are you?",
	});

	console.log(result.text);
	await session.dispose();
	await agent.dispose();
} else if (provider === "claude") {
	// -----------------------------------------------------------------------
	// Claude-specific options
	// -----------------------------------------------------------------------
	const { createAgent } = await import("@omni-agent-sdk/provider-claude");

	const config: ClaudeAgentConfig = {
		model: "claude-opus-4-6",
		permissions: "auto-approve",
		providerOptions: {
			// Enable extended thinking (requires a model that supports it)
			// betas: ["interleaved-thinking-2025-05-14"],

			// Choose the permission mode passed to the underlying claude-agent-sdk
			permissionMode: "acceptEdits",

			// Custom claude-agent-sdk settings source
			// settingSources: ["~/.claude/settings.json"],
		},
	};

	const agent = createAgent(config);
	const session = await agent.createSession({ cwd: process.cwd() });

	console.log("Claude provider-specific options demo\n");

	const result = await session.prompt({
		message: "What model are you?",
		providerOptions: {
			// Per-prompt provider options also accepted
		},
	});

	console.log(result.text);
	await session.dispose();
	await agent.dispose();
} else {
	// -----------------------------------------------------------------------
	// Codex-specific options
	// -----------------------------------------------------------------------
	const { createAgent } = await import("@omni-agent-sdk/provider-codex");

	const config: CodexAgentConfig = {
		model: "o3",
		permissions: "auto-approve",
		providerOptions: {
			// Approval policy for the underlying codex-sdk
			approvalPolicy: "never",

			// Reasoning effort for o-series models
			modelReasoningEffort: "medium",

			// Optionally skip git repo check on startup
			skipGitRepoCheck: true,
		},
	};

	const agent = createAgent(config);
	const session = await agent.createSession({ cwd: process.cwd() });

	console.log("Codex provider-specific options demo\n");

	const result = await session.prompt({
		message: "What model are you?",
	});

	console.log(result.text);
	await session.dispose();
	await agent.dispose();
}
