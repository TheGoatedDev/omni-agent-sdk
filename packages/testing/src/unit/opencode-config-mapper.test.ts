import type { OmniAgentConfig } from "@omni-agent-sdk/core";
import {
	buildPromptBody,
	parseModelString,
} from "../../../provider-opencode/src/mappers/config.js";
import type { OpenCodeAgentConfig } from "../../../provider-opencode/src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
	shape: Partial<OmniAgentConfig> & Record<string, unknown>,
): OpenCodeAgentConfig {
	return shape as unknown as OpenCodeAgentConfig;
}

// ---------------------------------------------------------------------------
// parseModelString
// ---------------------------------------------------------------------------

describe("parseModelString — slash-separated format", () => {
	it("splits 'anthropic/claude-3-5-sonnet-20241022' into providerID and modelID", () => {
		const result = parseModelString("anthropic/claude-3-5-sonnet-20241022");

		expect(result).toEqual({
			providerID: "anthropic",
			modelID: "claude-3-5-sonnet-20241022",
		});
	});

	it("splits 'openai/gpt-4o' into providerID and modelID", () => {
		const result = parseModelString("openai/gpt-4o");

		expect(result).toEqual({ providerID: "openai", modelID: "gpt-4o" });
	});

	it("treats the whole string as modelID when there is no slash", () => {
		const result = parseModelString("claude-opus-4-6");

		expect(result).toEqual({ providerID: undefined, modelID: "claude-opus-4-6" });
	});

	it("returns both undefined when input is undefined", () => {
		const result = parseModelString(undefined);

		expect(result).toEqual({ providerID: undefined, modelID: undefined });
	});

	it("handles a leading slash — providerID is empty string", () => {
		const result = parseModelString("/model-id");

		expect(result).toEqual({ providerID: "", modelID: "model-id" });
	});

	it("only splits on the first slash (modelID may contain slashes)", () => {
		const result = parseModelString("provider/org/model");

		expect(result).toEqual({ providerID: "provider", modelID: "org/model" });
	});
});

// ---------------------------------------------------------------------------
// buildPromptBody — message
// ---------------------------------------------------------------------------

describe("buildPromptBody — message field", () => {
	it("sets the message field from the message argument", () => {
		const body = buildPromptBody("Hello!", makeConfig({}));

		expect(body.message).toBe("Hello!");
	});

	it("preserves an empty message string", () => {
		const body = buildPromptBody("", makeConfig({}));

		expect(body.message).toBe("");
	});
});

// ---------------------------------------------------------------------------
// buildPromptBody — model resolution
// ---------------------------------------------------------------------------

describe("buildPromptBody — model resolution", () => {
	it("parses config.model as 'providerID/modelID'", () => {
		const body = buildPromptBody("hi", makeConfig({ model: "anthropic/claude-opus-4-6" }));

		expect(body.providerID).toBe("anthropic");
		expect(body.modelID).toBe("claude-opus-4-6");
	});

	it("promptOverrides.model takes precedence over config.model", () => {
		const body = buildPromptBody("hi", makeConfig({ model: "anthropic/claude-opus-4-6" }), {
			model: "openai/gpt-4o",
		});

		expect(body.providerID).toBe("openai");
		expect(body.modelID).toBe("gpt-4o");
	});

	it("providerOptions.providerID takes precedence over parsed model providerID", () => {
		const body = buildPromptBody(
			"hi",
			makeConfig({ model: "anthropic/claude-opus-4-6", providerOptions: { providerID: "vertex" } }),
		);

		expect(body.providerID).toBe("vertex");
		expect(body.modelID).toBe("claude-opus-4-6");
	});

	it("providerOptions.modelID takes precedence over parsed model modelID", () => {
		const body = buildPromptBody(
			"hi",
			makeConfig({
				model: "anthropic/claude-opus-4-6",
				providerOptions: { modelID: "claude-3-5-sonnet-20241022" },
			}),
		);

		expect(body.modelID).toBe("claude-3-5-sonnet-20241022");
	});

	it("omits providerID and modelID when no model is set", () => {
		const body = buildPromptBody("hi", makeConfig({}));

		expect(body.providerID).toBeUndefined();
		expect(body.modelID).toBeUndefined();
	});

	it("writes modelID without providerID when model has no slash", () => {
		const body = buildPromptBody("hi", makeConfig({ model: "claude-opus-4-6" }));

		expect(body.providerID).toBeUndefined();
		expect(body.modelID).toBe("claude-opus-4-6");
	});
});

// ---------------------------------------------------------------------------
// buildPromptBody — system prompt
// ---------------------------------------------------------------------------

describe("buildPromptBody — system prompt", () => {
	it("writes config.systemPrompt to body.system", () => {
		const body = buildPromptBody("hi", makeConfig({ systemPrompt: "Be concise." }));

		expect(body.system).toBe("Be concise.");
	});

	it("promptOverrides.systemPrompt takes precedence over config.systemPrompt", () => {
		const body = buildPromptBody("hi", makeConfig({ systemPrompt: "Default." }), {
			systemPrompt: "Override.",
		});

		expect(body.system).toBe("Override.");
	});

	it("omits system when no systemPrompt is set", () => {
		const body = buildPromptBody("hi", makeConfig({}));

		expect(body.system).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// buildPromptBody — agent
// ---------------------------------------------------------------------------

describe("buildPromptBody — agent option", () => {
	it("writes providerOptions.agent to body.agent", () => {
		const body = buildPromptBody("hi", makeConfig({ providerOptions: { agent: "coder" } }));

		expect(body.agent).toBe("coder");
	});

	it("omits agent when not set", () => {
		const body = buildPromptBody("hi", makeConfig({}));

		expect(body.agent).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// buildPromptBody — tools
// ---------------------------------------------------------------------------

describe("buildPromptBody — tools.allowed", () => {
	it("writes config.tools.allowed to body.tools", () => {
		const body = buildPromptBody("hi", makeConfig({ tools: { allowed: ["bash", "read_file"] } }));

		expect(body.tools).toEqual(["bash", "read_file"]);
	});

	it("omits tools when config.tools is undefined", () => {
		const body = buildPromptBody("hi", makeConfig({}));

		expect(body.tools).toBeUndefined();
	});

	it("omits tools when only tools.disallowed is set (not supported by PromptBody)", () => {
		const body = buildPromptBody("hi", makeConfig({ tools: { disallowed: ["rm"] } }));

		expect(body.tools).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// buildPromptBody — combined
// ---------------------------------------------------------------------------

describe("buildPromptBody — combined config", () => {
	it("builds a fully-populated PromptBody from a rich config", () => {
		const body = buildPromptBody(
			"Do something.",
			makeConfig({
				model: "anthropic/claude-opus-4-6",
				systemPrompt: "Be helpful.",
				tools: { allowed: ["bash"] },
				providerOptions: { agent: "coder" },
			}),
		);

		expect(body).toMatchObject({
			message: "Do something.",
			providerID: "anthropic",
			modelID: "claude-opus-4-6",
			system: "Be helpful.",
			tools: ["bash"],
			agent: "coder",
		});
	});
});
