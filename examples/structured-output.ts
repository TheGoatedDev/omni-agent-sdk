/**
 * structured-output.ts — JSON Schema outputSchema for typed responses
 *
 * Pass a JSON Schema object as outputSchema to ask the provider to return a
 * structured JSON response.  The parsed object is available on
 * result.structuredOutput and the raw JSON is in result.text.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/structured-output.ts
 *   OPENAI_API_KEY=sk-...   npx tsx examples/structured-output.ts codex
 */

import type { JsonSchema } from "@omni-agent-sdk/core";
import { createProviderAgent } from "./_helpers.js";

// ---------------------------------------------------------------------------
// Define a schema for a structured response
// ---------------------------------------------------------------------------

interface LanguageList {
	languages: Array<{
		name: string;
		year: number;
		paradigm: string;
	}>;
}

const schema: JsonSchema = {
	type: "object",
	required: ["languages"],
	properties: {
		languages: {
			type: "array",
			description: "List of programming languages",
			items: {
				type: "object",
				required: ["name", "year", "paradigm"],
				properties: {
					name: { type: "string", description: "Language name" },
					year: { type: "number", description: "Year the language was created" },
					paradigm: {
						type: "string",
						description: "Primary paradigm (e.g. functional, object-oriented)",
					},
				},
			},
		},
	},
};

// ---------------------------------------------------------------------------
// Request structured output
// ---------------------------------------------------------------------------

const agent = await createProviderAgent();
const session = await agent.createSession({ cwd: process.cwd() });

const result = await session.prompt({
	message: "Return exactly 3 well-known programming languages as JSON.",
	outputSchema: schema,
});

// result.structuredOutput is the parsed JSON object (unknown type — cast safely)
const typed = result.structuredOutput as LanguageList;

console.log("Structured output:");
for (const lang of typed.languages) {
	console.log(`  ${lang.name} (${lang.year}) — ${lang.paradigm}`);
}

console.log("\nRaw text response:");
console.log(result.text);

await session.dispose();
await agent.dispose();
