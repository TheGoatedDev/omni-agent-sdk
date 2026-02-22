/**
 * Type-only declarations for @anthropic-ai/claude-agent-sdk.
 *
 * The installed SDK's sdk.d.ts imports from packages (@anthropic-ai/sdk,
 * @modelcontextprotocol/sdk, Node builtins) that are not installed as direct
 * dependencies. We use `skipLibCheck: true` in tsconfig.json to suppress
 * those errors in node_modules .d.ts files.
 *
 * This file is intentionally minimal — it augments our understanding of the
 * SDK's re-exported core types that we use in our mappers. We import real
 * types directly from the package in source files.
 */

// This file is intentionally empty — all SDK types are imported directly
// from '@anthropic-ai/claude-agent-sdk' in source files, and skipLibCheck
// suppresses transitive dep errors in the installed package's .d.ts.
export {};
