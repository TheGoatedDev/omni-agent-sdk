import type { OmniEvent, OmniMessage } from "@omni-agent-sdk/core";
import { OmniAgentError } from "@omni-agent-sdk/core";
import type {
	EventMessagePartUpdated,
	EventMessageUpdated,
	EventSessionError,
	EventSessionIdle,
	OpenCodeEvent,
} from "@opencode-ai/sdk";
import { mapMessage } from "./message.js";

const PROVIDER = "opencode";

// ---------------------------------------------------------------------------
// Type guards for SSE events
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isEventWithSessionId(
	event: OpenCodeEvent,
): event is OpenCodeEvent & { sessionID: string } {
	return isObject(event) && typeof (event as Record<string, unknown>).sessionID === "string";
}

function isEventMessagePartUpdated(event: OpenCodeEvent): event is EventMessagePartUpdated {
	return event.type === "message.part.updated";
}

function isEventMessageUpdated(event: OpenCodeEvent): event is EventMessageUpdated {
	return event.type === "message.updated";
}

function isEventSessionIdle(event: OpenCodeEvent): event is EventSessionIdle {
	return event.type === "session.idle";
}

function isEventSessionError(event: OpenCodeEvent): event is EventSessionError {
	return event.type === "session.error";
}

// ---------------------------------------------------------------------------
// Part-level mapping helpers
// ---------------------------------------------------------------------------

function mapTextPartEvent(event: EventMessagePartUpdated): OmniEvent[] {
	const part = event.part;
	if (part.type !== "text") return [];

	// Emit a text_delta if there is a delta value
	const delta = part.delta;
	if (typeof delta === "string" && delta.length > 0) {
		return [{ type: "text_delta", text: delta }];
	}
	return [];
}

function mapToolPartEvent(event: EventMessagePartUpdated): OmniEvent[] {
	const part = event.part;
	if (part.type !== "tool") return [];

	switch (part.state) {
		case "running":
			return [
				{
					type: "tool_start",
					toolName: part.toolName,
					toolId: part.toolID,
					input: part.input,
				},
			];

		case "completed":
			return [
				{
					type: "tool_end",
					toolId: part.toolID,
					output: part.output,
					isError: false,
				},
			];

		case "error":
			return [
				{
					type: "tool_end",
					toolId: part.toolID,
					output: part.error,
					isError: true,
				},
			];

		// "pending" — tool has been queued but not yet started; no OmniEvent emitted
		default:
			return [];
	}
}

function mapReasoningPartEvent(event: EventMessagePartUpdated): OmniEvent[] {
	const part = event.part;
	if (part.type !== "reasoning") return [];

	// Emit a text_delta-like event for reasoning deltas
	const delta = part.delta;
	if (typeof delta === "string" && delta.length > 0) {
		return [{ type: "text_delta", text: delta }];
	}
	return [];
}

// ---------------------------------------------------------------------------
// Public mapper
// ---------------------------------------------------------------------------

/**
 * Maps a single OpenCode SSE event to zero or more OmniEvents.
 * Returns an empty array for events that have no OmniEvent equivalent.
 *
 * Terminal events (`session.idle`, `session.error`) are included so callers
 * can detect when a stream is finished.
 */
export function mapOpenCodeEvent(event: OpenCodeEvent): OmniEvent[] {
	if (!isObject(event)) return [];

	if (isEventMessagePartUpdated(event)) {
		const part = event.part;
		if (!isObject(part) || typeof (part as Record<string, unknown>).type !== "string") {
			return [];
		}
		switch (part.type) {
			case "text":
				return mapTextPartEvent(event);
			case "tool":
				return mapToolPartEvent(event);
			case "reasoning":
				return mapReasoningPartEvent(event);
			// "file" parts are not mapped to OmniEvents
			default:
				return [];
		}
	}

	if (isEventMessageUpdated(event)) {
		const omniMessage: OmniMessage = mapMessage(event.message);
		return [{ type: "message_end", message: omniMessage }];
	}

	if (isEventSessionIdle(event)) {
		return [{ type: "turn_end" }];
	}

	if (isEventSessionError(event)) {
		const omniError = new OmniAgentError(event.error, {
			provider: PROVIDER,
			code: "PROVIDER_ERROR",
			raw: event,
		});
		return [{ type: "error", error: omniError }];
	}

	// "session.status" and unknown events have no OmniEvent mapping
	return [];
}

/**
 * Returns true when the event signals the end of a streaming turn.
 * Used by OpenCodeStream to know when to stop consuming the SSE stream.
 */
export function isTerminalOpenCodeEvent(event: OpenCodeEvent): boolean {
	return event.type === "session.idle" || event.type === "session.error";
}

/**
 * Returns the sessionID embedded in an event, or undefined if the event
 * does not carry a sessionID.
 */
export function getEventSessionId(event: OpenCodeEvent): string | undefined {
	if (isEventWithSessionId(event)) {
		return event.sessionID;
	}
	return undefined;
}
