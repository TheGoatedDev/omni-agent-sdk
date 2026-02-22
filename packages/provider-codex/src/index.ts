export { CodexAgent } from "./adapter.js";
export { CodexSession } from "./session.js";
export { CodexStream } from "./stream.js";
export type { CodexAgentConfig, CodexProviderOptions } from "./types.js";

import { CodexAgent } from "./adapter.js";
import type { CodexAgentConfig } from "./types.js";

/**
 * Create a new CodexAgent from the provided configuration.
 *
 * This is the primary entry point for consumers of this package.
 *
 * @example
 * ```typescript
 * import { createAgent } from "@omni-agent-sdk/provider-codex";
 *
 * const agent = createAgent({ model: "o3", permissions: "auto-approve" });
 * const session = await agent.createSession({ cwd: "/my/project" });
 * const result = await session.prompt({ message: "Fix the failing tests." });
 * console.log(result.text);
 * ```
 */
export function createAgent(config: CodexAgentConfig): CodexAgent {
	return new CodexAgent(config);
}
