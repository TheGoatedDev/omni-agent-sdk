import { OpenCodeAgent } from "./adapter.js";
import type { OpenCodeAgentConfig } from "./types.js";

/**
 * Factory function — the primary entry point for the provider-opencode package.
 *
 * @example Client-only mode (connect to running OpenCode server):
 * ```typescript
 * import { createAgent } from "@omni-agent-sdk/provider-opencode";
 *
 * const agent = createAgent({
 *   model: "anthropic/claude-opus-4-6",
 *   providerOptions: { baseUrl: "http://localhost:4096" },
 * });
 * const session = await agent.createSession();
 * const result = await session.prompt({ message: "Hello!" });
 * console.log(result.text);
 * await session.dispose();
 * await agent.dispose();
 * ```
 *
 * @example Embedded mode (starts an OpenCode server automatically):
 * ```typescript
 * import { createAgent } from "@omni-agent-sdk/provider-opencode";
 *
 * const agent = createAgent({
 *   model: "anthropic/claude-opus-4-6",
 * });
 * const session = await agent.createSession();
 * const result = await session.prompt({ message: "Hello!" });
 * console.log(result.text);
 * await session.dispose();
 * await agent.dispose(); // also shuts down the embedded server
 * ```
 */
export function createAgent(config: OpenCodeAgentConfig): OpenCodeAgent {
	return new OpenCodeAgent(config);
}

export type { OpenCodeAgentConfig, OpenCodeProviderOptions } from "./types.js";
export { OpenCodeAgent } from "./adapter.js";
export { OpenCodeSession } from "./session.js";
export { OpenCodeStream } from "./stream.js";
