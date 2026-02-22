/**
 * mcp-servers.ts — Model Context Protocol (MCP) server configuration
 *
 * MCP servers extend the agent's toolset.  You can configure:
 *   - stdio servers: a local process spawned with command + args
 *   - URL servers:   a remote HTTP/SSE server at a given URL
 *
 * The agent automatically discovers and can call tools exposed by each server.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/mcp-servers.ts
 *   OPENAI_API_KEY=sk-...   npx tsx examples/mcp-servers.ts codex
 *
 * Note: this example configures real MCP server entries.  Replace the
 * command/url values with actual MCP server packages available in your env.
 */

import type { OmniMcpServerConfig } from "@omni-agent-sdk/core";
import { createProviderAgent, printUsage } from "./_helpers.js";

// ---------------------------------------------------------------------------
// MCP server definitions
// ---------------------------------------------------------------------------

// A stdio-based MCP server (spawned as a child process).
// Replace "@my-org/my-mcp-server" with a real package if you want to test.
const stdioServer: OmniMcpServerConfig = {
	command: "npx",
	args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
	env: {
		// Env vars passed exclusively to the MCP server process
		MCP_LOG_LEVEL: "error",
	},
};

// A URL-based MCP server (remote HTTP/SSE endpoint).
// Uncomment and replace with a real URL when available.
// const urlServer: OmniMcpServerConfig = { url: "https://my-mcp-host.example.com/sse" };

// ---------------------------------------------------------------------------
// Create agent with MCP servers registered
// ---------------------------------------------------------------------------

const agent = await createProviderAgent({
	mcpServers: {
		filesystem: stdioServer,
		// remote: urlServer,
	},
});

const session = await agent.createSession({ cwd: process.cwd() });

console.log(`Agent provider : ${agent.provider}`);
console.log("MCP servers    : filesystem (stdio)\n");

// The agent can now use tools provided by the filesystem MCP server
const result = await session.prompt({
	message:
		"Using the filesystem tools, list the files in the current directory " +
		"and tell me how many TypeScript files there are.",
});

console.log(result.text);
printUsage(result.usage);

await session.dispose();
await agent.dispose();
