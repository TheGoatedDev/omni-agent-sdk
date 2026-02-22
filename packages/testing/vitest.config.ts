import { defineConfig } from "vitest/config";

export default defineConfig({
	// Top-level resolve.alias applies to Vite's transform pipeline, which Vitest
	// uses for all test files and inlined dependencies.
	resolve: {
		alias: {
			"@omni-agent-sdk/core": new URL("../core/src/index.ts", import.meta.url).pathname,
			"@omni-agent-sdk/provider-claude": new URL("../provider-claude/src/index.ts", import.meta.url)
				.pathname,
			"@omni-agent-sdk/provider-codex": new URL("../provider-codex/src/index.ts", import.meta.url)
				.pathname,
			"@omni-agent-sdk/provider-opencode": new URL(
				"../provider-opencode/src/index.ts",
				import.meta.url,
			).pathname,
		},
	},
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts"],
		testTimeout: 60_000,
		server: {
			deps: {
				// Force workspace packages through Vite's transform pipeline so that
				// resolve.alias applies to dynamic `await import(...)` calls in tests,
				// ensuring source TypeScript files are used instead of stale dist/.
				inline: [/^@omni-agent-sdk\//],
			},
		},
	},
});
