import type { OmniEvent } from "@omni-agent-sdk/core";

/**
 * Structural representation of the raw Anthropic stream events carried inside
 * SDKPartialAssistantMessage.event. We narrow by `type` field using type
 * guards rather than importing the `BetaRawMessageStreamEvent` type, which
 * lives in @anthropic-ai/sdk (a transitive dep not installed directly).
 */
interface StreamEventBase {
	type: string;
}

interface MessageStartEvent extends StreamEventBase {
	type: "message_start";
	message: { id: string; role: string; model: string };
}

interface ContentBlockStartEvent extends StreamEventBase {
	type: "content_block_start";
	index: number;
	content_block:
		| { type: "text"; text: string }
		| { type: "tool_use"; id: string; name: string; input: unknown }
		| { type: string };
}

interface ContentBlockDeltaEvent extends StreamEventBase {
	type: "content_block_delta";
	index: number;
	delta:
		| { type: "text_delta"; text: string }
		| { type: "input_json_delta"; partial_json: string }
		| { type: string };
}

interface ContentBlockStopEvent extends StreamEventBase {
	type: "content_block_stop";
	index: number;
}

interface MessageDeltaEvent extends StreamEventBase {
	type: "message_delta";
}

interface MessageStopEvent extends StreamEventBase {
	type: "message_stop";
}

type KnownStreamEvent =
	| MessageStartEvent
	| ContentBlockStartEvent
	| ContentBlockDeltaEvent
	| ContentBlockStopEvent
	| MessageDeltaEvent
	| MessageStopEvent;

function isKnownStreamEvent(event: unknown): event is KnownStreamEvent {
	return (
		typeof event === "object" &&
		event !== null &&
		"type" in event &&
		typeof (event as { type: unknown }).type === "string"
	);
}

/**
 * Tracks in-progress tool-use blocks so we can accumulate their JSON input
 * across multiple `input_json_delta` events and emit `tool_end` on stop.
 */
export interface ToolBlockState {
	toolId: string;
	toolName: string;
	accumulatedJson: string;
}

export interface EventMapperState {
	/** Map from content block index to pending tool state. */
	toolBlocks: Map<number, ToolBlockState>;
}

export function createEventMapperState(): EventMapperState {
	return { toolBlocks: new Map() };
}

/**
 * Maps a single raw Anthropic stream event to zero or more OmniEvents.
 * The mapper is stateful: tool input JSON is accumulated across deltas.
 */
export function mapStreamEvent(rawEvent: unknown, state: EventMapperState): OmniEvent[] {
	if (!isKnownStreamEvent(rawEvent)) {
		return [];
	}

	const event = rawEvent;
	const events: OmniEvent[] = [];

	switch (event.type) {
		case "message_start": {
			events.push({ type: "message_start", role: "assistant" });
			break;
		}

		case "content_block_start": {
			const e = event as ContentBlockStartEvent;
			const block = e.content_block;
			if (block.type === "tool_use") {
				const toolBlock = block as { type: "tool_use"; id: string; name: string; input: unknown };
				state.toolBlocks.set(e.index, {
					toolId: toolBlock.id,
					toolName: toolBlock.name,
					accumulatedJson: "",
				});
				events.push({
					type: "tool_start",
					toolName: toolBlock.name,
					toolId: toolBlock.id,
				});
			}
			break;
		}

		case "content_block_delta": {
			const e = event as ContentBlockDeltaEvent;
			const delta = e.delta;
			if (delta.type === "text_delta") {
				const td = delta as { type: "text_delta"; text: string };
				events.push({ type: "text_delta", text: td.text });
			} else if (delta.type === "input_json_delta") {
				// Accumulate tool input JSON — no event emitted yet
				const jd = delta as { type: "input_json_delta"; partial_json: string };
				const toolState = state.toolBlocks.get(e.index);
				if (toolState !== undefined) {
					toolState.accumulatedJson += jd.partial_json;
				}
			}
			break;
		}

		case "content_block_stop": {
			const e = event as ContentBlockStopEvent;
			const toolState = state.toolBlocks.get(e.index);
			if (toolState !== undefined) {
				// Parse accumulated JSON for the tool input, if any
				let parsedInput: unknown = undefined;
				if (toolState.accumulatedJson.length > 0) {
					try {
						parsedInput = JSON.parse(toolState.accumulatedJson) as unknown;
					} catch {
						// Leave as the raw string if unparseable — the tool call was malformed
						parsedInput = toolState.accumulatedJson;
					}
				}
				events.push({
					type: "tool_end",
					toolId: toolState.toolId,
					output: parsedInput,
					isError: false,
				});
				state.toolBlocks.delete(e.index);
			}
			break;
		}

		// message_delta and message_stop don't map to OmniEvents directly;
		// turn_end is emitted separately when SDKResultMessage arrives.
		case "message_delta":
		case "message_stop":
			break;
	}

	return events;
}
