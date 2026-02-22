import {
	createEventMapperState,
	mapStreamEvent,
} from "../../../provider-claude/src/mappers/event.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid message_start event. */
function messageStart() {
	return { type: "message_start", message: { id: "msg_1", role: "assistant", model: "claude-3" } };
}

/** content_block_start for a text block at the given index. */
function textBlockStart(index = 0) {
	return { type: "content_block_start", index, content_block: { type: "text", text: "" } };
}

/** content_block_start for a tool_use block at the given index. */
function toolBlockStart(index = 0, id = "tool_1", name = "bash") {
	return {
		type: "content_block_start",
		index,
		content_block: { type: "tool_use", id, name, input: {} },
	};
}

/** content_block_delta carrying a text_delta. */
function textDelta(index = 0, text = "hello") {
	return { type: "content_block_delta", index, delta: { type: "text_delta", text } };
}

/** content_block_delta carrying an input_json_delta. */
function jsonDelta(index, partial_json: string) {
	return { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json } };
}

/** content_block_stop at the given index. */
function blockStop(index = 0) {
	return { type: "content_block_stop", index };
}

// ---------------------------------------------------------------------------
// message_start
// ---------------------------------------------------------------------------

describe("mapStreamEvent — message_start", () => {
	it("emits a single message_start event with role assistant", () => {
		const state = createEventMapperState();
		const events = mapStreamEvent(messageStart(), state);
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ type: "message_start", role: "assistant" });
	});
});

// ---------------------------------------------------------------------------
// content_block_start
// ---------------------------------------------------------------------------

describe("mapStreamEvent — content_block_start", () => {
	it("emits nothing for a text content block", () => {
		const state = createEventMapperState();
		const events = mapStreamEvent(textBlockStart(), state);
		expect(events).toHaveLength(0);
	});

	it("does not store state for a text content block", () => {
		const state = createEventMapperState();
		mapStreamEvent(textBlockStart(2), state);
		expect(state.toolBlocks.has(2)).toBe(false);
	});

	it("emits tool_start for a tool_use block", () => {
		const state = createEventMapperState();
		const events = mapStreamEvent(toolBlockStart(0, "tool_abc", "read_file"), state);
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ type: "tool_start", toolName: "read_file", toolId: "tool_abc" });
	});

	it("stores tool block state on tool_use start", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(3, "tool_xyz", "write_file"), state);
		const stored = state.toolBlocks.get(3);
		expect(stored).toBeDefined();
		expect(stored?.toolId).toBe("tool_xyz");
		expect(stored?.toolName).toBe("write_file");
		expect(stored?.accumulatedJson).toBe("");
	});

	it("stores independent states for concurrent tool blocks at different indices", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "id_0", "tool_a"), state);
		mapStreamEvent(toolBlockStart(1, "id_1", "tool_b"), state);
		expect(state.toolBlocks.get(0)?.toolId).toBe("id_0");
		expect(state.toolBlocks.get(1)?.toolId).toBe("id_1");
	});

	it("emits nothing for an unknown content_block type", () => {
		const state = createEventMapperState();
		const event = {
			type: "content_block_start",
			index: 0,
			content_block: { type: "image" },
		};
		const events = mapStreamEvent(event, state);
		expect(events).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// content_block_delta
// ---------------------------------------------------------------------------

describe("mapStreamEvent — content_block_delta (text_delta)", () => {
	it("emits a text_delta event with the correct text", () => {
		const state = createEventMapperState();
		const events = mapStreamEvent(textDelta(0, "world"), state);
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ type: "text_delta", text: "world" });
	});

	it("emits text_delta with an empty string when text is empty", () => {
		const state = createEventMapperState();
		const events = mapStreamEvent(textDelta(0, ""), state);
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ type: "text_delta", text: "" });
	});
});

describe("mapStreamEvent — content_block_delta (input_json_delta)", () => {
	it("emits nothing when accumulating json input", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "t1", "bash"), state);
		const events = mapStreamEvent(jsonDelta(0, '{"cmd":'), state);
		expect(events).toHaveLength(0);
	});

	it("accumulates partial json into tool block state", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "t1", "bash"), state);
		mapStreamEvent(jsonDelta(0, '{"cmd":'), state);
		mapStreamEvent(jsonDelta(0, '"ls"}'), state);
		expect(state.toolBlocks.get(0)?.accumulatedJson).toBe('{"cmd":"ls"}');
	});

	it("silently ignores an input_json_delta for an index with no active tool block", () => {
		const state = createEventMapperState();
		// No toolBlockStart at index 5
		const events = mapStreamEvent(jsonDelta(5, '{"x":1}'), state);
		expect(events).toHaveLength(0);
		expect(state.toolBlocks.has(5)).toBe(false);
	});

	it("accumulates json independently for concurrent tool blocks", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "t0", "tool_a"), state);
		mapStreamEvent(toolBlockStart(1, "t1", "tool_b"), state);
		mapStreamEvent(jsonDelta(0, '{"a":'), state);
		mapStreamEvent(jsonDelta(1, '{"b":'), state);
		mapStreamEvent(jsonDelta(0, "1}"), state);
		mapStreamEvent(jsonDelta(1, "2}"), state);
		expect(state.toolBlocks.get(0)?.accumulatedJson).toBe('{"a":1}');
		expect(state.toolBlocks.get(1)?.accumulatedJson).toBe('{"b":2}');
	});

	it("emits nothing for an unknown delta type", () => {
		const state = createEventMapperState();
		const event = {
			type: "content_block_delta",
			index: 0,
			delta: { type: "thinking_delta", thinking: "..." },
		};
		const events = mapStreamEvent(event, state);
		expect(events).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// content_block_stop
// ---------------------------------------------------------------------------

describe("mapStreamEvent — content_block_stop (tool block present)", () => {
	it("emits tool_end with parsed JSON output", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "tool_1", "bash"), state);
		mapStreamEvent(jsonDelta(0, '{"cmd":"ls"}'), state);
		const events = mapStreamEvent(blockStop(0), state);
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			type: "tool_end",
			toolId: "tool_1",
			output: { cmd: "ls" },
			isError: false,
		});
	});

	it("sets isError to false on tool_end", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "t1", "bash"), state);
		mapStreamEvent(jsonDelta(0, "{}"), state);
		const events = mapStreamEvent(blockStop(0), state);
		expect((events[0] as { isError: boolean }).isError).toBe(false);
	});

	it("removes the tool block from state after stop", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "t1", "bash"), state);
		mapStreamEvent(blockStop(0), state);
		expect(state.toolBlocks.has(0)).toBe(false);
	});

	it("emits tool_end with output: undefined when no JSON was accumulated", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "t1", "no_input_tool"), state);
		// No jsonDelta events
		const events = mapStreamEvent(blockStop(0), state);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({ type: "tool_end", toolId: "t1", output: undefined });
	});

	it("falls back to the raw string when accumulated JSON is malformed", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "t1", "bash"), state);
		mapStreamEvent(jsonDelta(0, "{not valid json"), state);
		const events = mapStreamEvent(blockStop(0), state);
		expect(events).toHaveLength(1);
		expect((events[0] as { output: unknown }).output).toBe("{not valid json");
	});

	it("parses a JSON array correctly", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "t1", "list_tool"), state);
		mapStreamEvent(jsonDelta(0, "[1,2,3]"), state);
		const events = mapStreamEvent(blockStop(0), state);
		expect((events[0] as { output: unknown }).output).toEqual([1, 2, 3]);
	});

	it("parses a JSON primitive (number) correctly", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "t1", "count_tool"), state);
		mapStreamEvent(jsonDelta(0, "42"), state);
		const events = mapStreamEvent(blockStop(0), state);
		expect((events[0] as { output: unknown }).output).toBe(42);
	});

	it("handles multi-chunk JSON accumulation before stop", () => {
		const state = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "t1", "bash"), state);
		mapStreamEvent(jsonDelta(0, '{"a":'), state);
		mapStreamEvent(jsonDelta(0, '"hello"'), state);
		mapStreamEvent(jsonDelta(0, "}"), state);
		const events = mapStreamEvent(blockStop(0), state);
		expect((events[0] as { output: unknown }).output).toEqual({ a: "hello" });
	});
});

describe("mapStreamEvent — content_block_stop (no tool block)", () => {
	it("emits nothing when no tool block exists at the index", () => {
		const state = createEventMapperState();
		const events = mapStreamEvent(blockStop(0), state);
		expect(events).toHaveLength(0);
	});

	it("emits nothing for a text block stop (text blocks are never stored)", () => {
		const state = createEventMapperState();
		mapStreamEvent(textBlockStart(0), state);
		const events = mapStreamEvent(blockStop(0), state);
		expect(events).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// message_delta and message_stop
// ---------------------------------------------------------------------------

describe("mapStreamEvent — message_delta", () => {
	it("emits nothing", () => {
		const state = createEventMapperState();
		const events = mapStreamEvent({ type: "message_delta" }, state);
		expect(events).toHaveLength(0);
	});
});

describe("mapStreamEvent — message_stop", () => {
	it("emits nothing", () => {
		const state = createEventMapperState();
		const events = mapStreamEvent({ type: "message_stop" }, state);
		expect(events).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Unknown / invalid inputs
// ---------------------------------------------------------------------------

describe("mapStreamEvent — unknown event types", () => {
	it("emits nothing for a completely unknown event type", () => {
		const state = createEventMapperState();
		const events = mapStreamEvent({ type: "some_future_event" }, state);
		expect(events).toHaveLength(0);
	});

	it("emits nothing for an event with a numeric type field", () => {
		const state = createEventMapperState();
		const events = mapStreamEvent({ type: 42 }, state);
		expect(events).toHaveLength(0);
	});
});

describe("mapStreamEvent — non-object raw events", () => {
	it("emits nothing for null", () => {
		const state = createEventMapperState();
		expect(mapStreamEvent(null, state)).toHaveLength(0);
	});

	it("emits nothing for undefined", () => {
		const state = createEventMapperState();
		expect(mapStreamEvent(undefined, state)).toHaveLength(0);
	});

	it("emits nothing for a string", () => {
		const state = createEventMapperState();
		expect(mapStreamEvent("message_start", state)).toHaveLength(0);
	});

	it("emits nothing for a number", () => {
		const state = createEventMapperState();
		expect(mapStreamEvent(123, state)).toHaveLength(0);
	});

	it("emits nothing for an array", () => {
		const state = createEventMapperState();
		expect(mapStreamEvent([], state)).toHaveLength(0);
	});

	it("emits nothing for an object missing the type field", () => {
		const state = createEventMapperState();
		expect(mapStreamEvent({ role: "assistant" }, state)).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// createEventMapperState
// ---------------------------------------------------------------------------

describe("createEventMapperState", () => {
	it("returns an object with an empty toolBlocks Map", () => {
		const state = createEventMapperState();
		expect(state.toolBlocks).toBeInstanceOf(Map);
		expect(state.toolBlocks.size).toBe(0);
	});

	it("returns a new independent state on each call", () => {
		const s1 = createEventMapperState();
		const s2 = createEventMapperState();
		mapStreamEvent(toolBlockStart(0, "t1", "bash"), s1);
		expect(s2.toolBlocks.size).toBe(0);
	});
});
