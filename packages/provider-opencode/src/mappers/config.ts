import type { OmniAgentConfig } from "@omni-agent-sdk/core";
import type { PromptBody } from "@opencode-ai/sdk";
import type { OpenCodeProviderOptions } from "../types.js";

export interface PromptOverrides {
	model?: string;
	systemPrompt?: string;
	maxTurns?: number;
	maxBudgetUsd?: number;
}

/**
 * Parse a model string in the format "providerID/modelID" (e.g. "anthropic/claude-3-5-sonnet-20241022").
 * Returns undefined values if the string is absent or not in slash-separated format.
 */
export function parseModelString(model: string | undefined): {
	providerID: string | undefined;
	modelID: string | undefined;
} {
	if (model === undefined) {
		return { providerID: undefined, modelID: undefined };
	}
	const slashIndex = model.indexOf("/");
	if (slashIndex === -1) {
		// No slash — treat the whole string as modelID with no providerID
		return { providerID: undefined, modelID: model };
	}
	return {
		providerID: model.slice(0, slashIndex),
		modelID: model.slice(slashIndex + 1),
	};
}

/**
 * Maps OmniAgentConfig (plus optional per-prompt overrides) into the PromptBody
 * accepted by the OpenCode SDK's session.prompt() and session.promptAsync() methods.
 *
 * Model resolution priority (highest to lowest):
 *   1. providerOptions.providerID / providerOptions.modelID  (explicit override)
 *   2. prompt-level model string (parsed at "/")
 *   3. agent-level model string (parsed at "/")
 */
export function buildPromptBody(
	message: string,
	config: OmniAgentConfig,
	promptOverrides?: PromptOverrides,
): PromptBody {
	const providerOptions = (config.providerOptions ?? {}) as OpenCodeProviderOptions;

	// Resolve model — prompt-level takes precedence over agent-level
	const modelStr = promptOverrides?.model ?? config.model;
	const { providerID: parsedProviderID, modelID: parsedModelID } = parseModelString(modelStr);

	// Explicit providerOptions take precedence over parsed model string
	const providerID = providerOptions.providerID ?? parsedProviderID;
	const modelID = providerOptions.modelID ?? parsedModelID;

	const body: PromptBody = { message };

	if (providerID !== undefined) {
		body.providerID = providerID;
	}
	if (modelID !== undefined) {
		body.modelID = modelID;
	}
	if (providerOptions.agent !== undefined) {
		body.agent = providerOptions.agent;
	}

	// System prompt: prompt-level takes precedence over agent-level
	const systemPrompt = promptOverrides?.systemPrompt ?? config.systemPrompt;
	if (systemPrompt !== undefined) {
		body.system = systemPrompt;
	}

	// Tool allow list (disallow is not supported by OpenCode's PromptBody)
	if (config.tools?.allowed !== undefined) {
		body.tools = config.tools.allowed;
	}

	return body;
}
