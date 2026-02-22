import type { OmniEvent } from "@omni-agent-sdk/core";
import type { OpenCodeEvent } from "@opencode-ai/sdk";
import {
	getEventSessionId,
	isTerminalOpenCodeEvent,
	mapOpenCodeEvent,
} from "../../../provider-opencode/src/mappers/event.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(shape: Record<string, unknown>): OpenCodeEvent {
	return shape as unknown as OpenCodeEvent;
}

// ---------------------------------------------------------------------------
// message.part.updated — TextPart with delta
// ---------------------------------------------------------------------------

describe("mapOpenCodeEvent — message.part.updated / TextPart", () => {
	it("returns a text_delta event when part has a non-empty delta", () => {
		const event = makeEvent({
			type: "message.part.updated",
			sessionID: "sess-1",
			messageID: "msg-1",
			part: { type: "text", text: "Hello, world!", delta: "Hello, " },
		});

		const result = mapOpenCodeEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual<OmniEvent>({ type: "text_delta", text: "Hello, " });
	});

	it("returns an empty array when TextPart delta is absent", () => {
		const event = makeEvent({
			type: "message.part.updated",
			sessionID: "sess-1",
			messageID: "msg-1",
			part: { type: "text", text: "Complete text." },
		});

		expect(mapOpenCodeEvent(event)).toEqual([]);
	});

	it("returns an empty array when TextPart delta is an empty string", () => {
		const event = makeEvent({
			type: "message.part.updated",
			sessionID: "sess-1",
			messageID: "msg-1",
			part: { type: "text", text: "Complete text.", delta: "" },
		});

		expect(mapOpenCodeEvent(event)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// message.part.updated — ToolPart states
// ---------------------------------------------------------------------------

describe("mapOpenCodeEvent — message.part.updated / ToolPart (running)", () => {
	it("returns a tool_start event when state is 'running'", () => {
		const event = makeEvent({
			type: "message.part.updated",
			sessionID: "sess-1",
			messageID: "msg-1",
			part: {
				type: "tool",
				toolName: "bash",
				toolID: "tool-42",
				state: "running",
				input: { cmd: "ls -la" },
			},
		});

		const result = mapOpenCodeEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject<Partial<OmniEvent>>({
			type: "tool_start",
			toolName: "bash",
			toolId: "tool-42",
			input: { cmd: "ls -la" },
		});
	});
});

describe("mapOpenCodeEvent — message.part.updated / ToolPart (completed)", () => {
	it("returns a tool_end event with isError false when state is 'completed'", () => {
		const event = makeEvent({
			type: "message.part.updated",
			sessionID: "sess-1",
			messageID: "msg-1",
			part: {
				type: "tool",
				toolName: "bash",
				toolID: "tool-42",
				state: "completed",
				input: { cmd: "ls" },
				output: "file1.ts\nfile2.ts",
			},
		});

		const result = mapOpenCodeEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject<Partial<OmniEvent>>({
			type: "tool_end",
			toolId: "tool-42",
			output: "file1.ts\nfile2.ts",
			isError: false,
		});
	});
});

describe("mapOpenCodeEvent — message.part.updated / ToolPart (error)", () => {
	it("returns a tool_end event with isError true when state is 'error'", () => {
		const event = makeEvent({
			type: "message.part.updated",
			sessionID: "sess-1",
			messageID: "msg-1",
			part: {
				type: "tool",
				toolName: "bash",
				toolID: "tool-42",
				state: "error",
				error: "command not found",
			},
		});

		const result = mapOpenCodeEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject<Partial<OmniEvent>>({
			type: "tool_end",
			toolId: "tool-42",
			output: "command not found",
			isError: true,
		});
	});
});

describe("mapOpenCodeEvent — message.part.updated / ToolPart (pending)", () => {
	it("returns an empty array when state is 'pending'", () => {
		const event = makeEvent({
			type: "message.part.updated",
			sessionID: "sess-1",
			messageID: "msg-1",
			part: { type: "tool", toolName: "bash", toolID: "tool-1", state: "pending" },
		});

		expect(mapOpenCodeEvent(event)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// message.part.updated — ReasoningPart
// ---------------------------------------------------------------------------

describe("mapOpenCodeEvent — message.part.updated / ReasoningPart", () => {
	it("returns a text_delta event for a reasoning delta", () => {
		const event = makeEvent({
			type: "message.part.updated",
			sessionID: "sess-1",
			messageID: "msg-1",
			part: { type: "reasoning", text: "Let me think...", delta: "Let me " },
		});

		const result = mapOpenCodeEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual<OmniEvent>({ type: "text_delta", text: "Let me " });
	});

	it("returns an empty array when reasoning delta is absent", () => {
		const event = makeEvent({
			type: "message.part.updated",
			sessionID: "sess-1",
			messageID: "msg-1",
			part: { type: "reasoning", text: "Final reasoning." },
		});

		expect(mapOpenCodeEvent(event)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// message.part.updated — FilePart (skipped)
// ---------------------------------------------------------------------------

describe("mapOpenCodeEvent — message.part.updated / FilePart", () => {
	it("returns an empty array for a file part (not mapped to OmniEvent)", () => {
		const event = makeEvent({
			type: "message.part.updated",
			sessionID: "sess-1",
			messageID: "msg-1",
			part: { type: "file", path: "src/main.ts", mime: "text/typescript" },
		});

		expect(mapOpenCodeEvent(event)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// message.updated
// ---------------------------------------------------------------------------

describe("mapOpenCodeEvent — message.updated", () => {
	it("returns a message_end event with a mapped OmniMessage", () => {
		const event = makeEvent({
			type: "message.updated",
			sessionID: "sess-1",
			message: {
				id: "msg-10",
				role: "assistant",
				parts: [{ type: "text", text: "Done." }],
			},
		});

		const result = mapOpenCodeEvent(event);

		expect(result).toHaveLength(1);
		const ev = result[0] as Extract<OmniEvent, { type: "message_end" }>;
		expect(ev.type).toBe("message_end");
		expect(ev.message.id).toBe("msg-10");
		expect(ev.message.role).toBe("assistant");
		expect(ev.message.content).toEqual([{ type: "text", text: "Done." }]);
	});
});

// ---------------------------------------------------------------------------
// session.idle
// ---------------------------------------------------------------------------

describe("mapOpenCodeEvent — session.idle", () => {
	it("returns a turn_end event", () => {
		const event = makeEvent({ type: "session.idle", sessionID: "sess-1" });

		const result = mapOpenCodeEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual<OmniEvent>({ type: "turn_end" });
	});
});

// ---------------------------------------------------------------------------
// session.error
// ---------------------------------------------------------------------------

describe("mapOpenCodeEvent — session.error", () => {
	it("returns an error event with the error message", () => {
		const event = makeEvent({
			type: "session.error",
			sessionID: "sess-1",
			error: "Model context limit exceeded",
		});

		const result = mapOpenCodeEvent(event);

		expect(result).toHaveLength(1);
		const ev = result[0] as Extract<OmniEvent, { type: "error" }>;
		expect(ev.type).toBe("error");
		expect(ev.error.message).toBe("Model context limit exceeded");
		expect(ev.error.provider).toBe("opencode");
	});
});

// ---------------------------------------------------------------------------
// session.status (no OmniEvent mapping)
// ---------------------------------------------------------------------------

describe("mapOpenCodeEvent — session.status", () => {
	it("returns an empty array for session.status events", () => {
		const event = makeEvent({ type: "session.status", sessionID: "sess-1", status: "running" });

		expect(mapOpenCodeEvent(event)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Unknown event types
// ---------------------------------------------------------------------------

describe("mapOpenCodeEvent — unknown event types", () => {
	it("returns an empty array for an unknown event type", () => {
		const event = makeEvent({ type: "some.unknown.event" });

		expect(mapOpenCodeEvent(event)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// isTerminalOpenCodeEvent
// ---------------------------------------------------------------------------

describe("isTerminalOpenCodeEvent", () => {
	it("returns true for session.idle", () => {
		const event = makeEvent({ type: "session.idle", sessionID: "sess-1" });
		expect(isTerminalOpenCodeEvent(event)).toBe(true);
	});

	it("returns true for session.error", () => {
		const event = makeEvent({ type: "session.error", sessionID: "sess-1", error: "oops" });
		expect(isTerminalOpenCodeEvent(event)).toBe(true);
	});

	it("returns false for message.part.updated", () => {
		const event = makeEvent({
			type: "message.part.updated",
			sessionID: "sess-1",
			messageID: "msg-1",
			part: { type: "text", text: "hi", delta: "hi" },
		});
		expect(isTerminalOpenCodeEvent(event)).toBe(false);
	});

	it("returns false for message.updated", () => {
		const event = makeEvent({
			type: "message.updated",
			sessionID: "sess-1",
			message: { id: "m1", role: "assistant", parts: [] },
		});
		expect(isTerminalOpenCodeEvent(event)).toBe(false);
	});

	it("returns false for session.status", () => {
		const event = makeEvent({ type: "session.status", sessionID: "sess-1", status: "running" });
		expect(isTerminalOpenCodeEvent(event)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// getEventSessionId
// ---------------------------------------------------------------------------

describe("getEventSessionId", () => {
	it("returns the sessionID from a session.idle event", () => {
		const event = makeEvent({ type: "session.idle", sessionID: "my-session" });
		expect(getEventSessionId(event)).toBe("my-session");
	});

	it("returns the sessionID from a message.part.updated event", () => {
		const event = makeEvent({
			type: "message.part.updated",
			sessionID: "sess-abc",
			messageID: "m1",
			part: { type: "text", text: "hi" },
		});
		expect(getEventSessionId(event)).toBe("sess-abc");
	});

	it("returns undefined for an event without sessionID", () => {
		const event = makeEvent({ type: "some.unknown.event" });
		expect(getEventSessionId(event)).toBeUndefined();
	});
});
