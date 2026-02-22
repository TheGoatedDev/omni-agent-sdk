import type { OmniAgentConfig } from "@omni-agent-sdk/core";

export interface OpenCodeProviderOptions {
	/** Connect to an existing OpenCode server (client-only mode). Mutually exclusive with embedded mode options. */
	baseUrl?: string;
	/** Embedded server hostname (default: "127.0.0.1"). Only used when baseUrl is absent. */
	hostname?: string;
	/** Embedded server port (default: 4096). Only used when baseUrl is absent. */
	port?: number;
	/** Server startup timeout in milliseconds (default: 5000). Only used when baseUrl is absent. */
	timeout?: number;
	/** OpenCode agent name to use (e.g. "default"). */
	agent?: string;
	/** Provider ID, e.g. "anthropic" or "openai". Takes precedence over model string parsing. */
	providerID?: string;
	/** Model ID, e.g. "claude-3-5-sonnet-20241022". Takes precedence over model string parsing. */
	modelID?: string;
}

export interface OpenCodeAgentConfig extends OmniAgentConfig {
	providerOptions?: OpenCodeProviderOptions & Record<string, unknown>;
}
