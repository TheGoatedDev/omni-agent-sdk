/**
 * custom-permissions.ts — function-based OmniPermissionPolicy
 *
 * The permissions field accepts either a preset string or an object with a
 * canUseTool() callback.  The callback receives a ToolPermissionRequest and
 * returns "allow", "deny", or "ask" (escalate to the user / shell).
 *
 * Use cases:
 *   - Block dangerous tools (bash, file-delete) unconditionally
 *   - Allow read-only tools, deny write tools
 *   - Log every tool call for auditing
 *   - Implement custom approval UIs
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/custom-permissions.ts
 *   OPENAI_API_KEY=sk-...   npx tsx examples/custom-permissions.ts codex
 */

import type { OmniPermissionPolicy, ToolPermissionRequest } from "@omni-agent-sdk/core";
import { createProviderAgent } from "./_helpers.js";

// ---------------------------------------------------------------------------
// Custom policy: allow read-only tools, deny shell and write operations
// ---------------------------------------------------------------------------

const auditLog: Array<{ tool: string; decision: "allow" | "deny" | "ask" }> = [];

const readOnlyPolicy: OmniPermissionPolicy = {
	canUseTool: async (req: ToolPermissionRequest): Promise<"allow" | "deny" | "ask"> => {
		const tool = req.toolName.toLowerCase();

		// Always deny shell access
		if (tool === "bash" || tool === "shell" || tool === "execute") {
			auditLog.push({ tool: req.toolName, decision: "deny" });
			console.log(`  [policy] DENY  ${req.toolName}`);
			return "deny";
		}

		// Deny write / destructive operations
		if (
			tool.includes("write") ||
			tool.includes("delete") ||
			tool.includes("remove") ||
			tool.includes("create")
		) {
			auditLog.push({ tool: req.toolName, decision: "deny" });
			console.log(`  [policy] DENY  ${req.toolName}`);
			return "deny";
		}

		// Allow everything else (read, list, search …)
		auditLog.push({ tool: req.toolName, decision: "allow" });
		console.log(`  [policy] ALLOW ${req.toolName}`);
		return "allow";
	},
};

// ---------------------------------------------------------------------------
// Run with the custom policy
// ---------------------------------------------------------------------------

const agent = await createProviderAgent({ permissions: readOnlyPolicy });
const session = await agent.createSession({ cwd: process.cwd() });

console.log("Sending prompt with custom read-only permission policy...\n");

const result = await session.prompt({
	message: "List the files in the current directory and describe what each one does.",
});

console.log(`\n${"─".repeat(60)}`);
console.log(result.text);
console.log("─".repeat(60));

if (auditLog.length > 0) {
	console.log("\nAudit log:");
	for (const entry of auditLog) {
		console.log(`  ${entry.decision.toUpperCase().padEnd(5)} ${entry.tool}`);
	}
}

await session.dispose();
await agent.dispose();
