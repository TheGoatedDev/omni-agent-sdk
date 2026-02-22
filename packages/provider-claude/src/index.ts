import { ClaudeAgent } from "./adapter.js";
import type { ClaudeAgentConfig } from "./types.js";

/**
 * Factory function — the primary entry point for the provider-claude package.
 *
 * @example
 * ```typescript
 * import { createAgent } from "@omni-agent-sdk/provider-claude";
 *
 * const agent = createAgent({ model: "claude-opus-4-6", permissions: "auto-approve" });
 * const session = await agent.createSession();
 * const result = await session.prompt({ message: "Hello!" });
 * console.log(result.text);
 * await session.dispose();
 * await agent.dispose();
 * ```
 */
export function createAgent(config: ClaudeAgentConfig): ClaudeAgent {
	return new ClaudeAgent(config);
}

export type { ClaudeAgentConfig, ClaudeProviderOptions } from "./types.js";
export { ClaudeAgent } from "./adapter.js";
export { ClaudeSession } from "./session.js";
export { ClaudeStream } from "./stream.js";
