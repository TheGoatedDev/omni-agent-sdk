import type { OmniEvent } from "@omni-agent-sdk/core";
import type { CodexEvent } from "@openai/codex-sdk";
import { mapCodexEvent } from "../../../provider-codex/src/mappers/event.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(shape: Record<string, unknown>): CodexEvent {
	return shape as unknown as CodexEvent;
}

// ---------------------------------------------------------------------------
// item.started — agentMessage
// ---------------------------------------------------------------------------

describe("mapCodexEvent — item.started / agentMessage", () => {
	it("returns a message_start event with role assistant (camelCase)", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "agentMessage", id: "msg-1" },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual<OmniEvent>({ type: "message_start", role: "assistant" });
	});

	it("returns a message_start event with role assistant (snake_case, live SDK)", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "agent_message", id: "msg-2" },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual<OmniEvent>({ type: "message_start", role: "assistant" });
	});
});

// ---------------------------------------------------------------------------
// item.started — tool items (commandExecution, mcpToolCall, fileChange)
// ---------------------------------------------------------------------------

describe("mapCodexEvent — item.started / commandExecution", () => {
	it("returns a tool_start event with default toolName 'commandExecution'", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "commandExecution", id: "cmd-1" },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject<Partial<OmniEvent>>({
			type: "tool_start",
			toolName: "commandExecution",
			toolId: "codex:cmd-1",
		});
	});

	it("uses item.toolName when provided instead of the default", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "commandExecution", id: "cmd-2", toolName: "shell_exec" },
		});

		const result = mapCodexEvent(event);

		expect(result[0]).toMatchObject<Partial<OmniEvent>>({
			type: "tool_start",
			toolName: "shell_exec",
			toolId: "codex:cmd-2",
		});
	});

	it("uses item.toolCallId when provided instead of 'codex:<id>'", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "commandExecution", id: "cmd-3", toolCallId: "call-abc" },
		});

		const result = mapCodexEvent(event);

		expect(result[0]).toMatchObject<Partial<OmniEvent>>({
			type: "tool_start",
			toolId: "call-abc",
		});
	});

	it("forwards item.input when present", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "commandExecution", id: "cmd-4", input: { cmd: "ls -la" } },
		});

		const result = mapCodexEvent(event);

		expect(result[0]).toMatchObject({ type: "tool_start", input: { cmd: "ls -la" } });
	});
});

describe("mapCodexEvent — item.started / mcpToolCall", () => {
	it("returns a tool_start event with default toolName 'mcpToolCall'", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "mcpToolCall", id: "mcp-1" },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject<Partial<OmniEvent>>({
			type: "tool_start",
			toolName: "mcpToolCall",
			toolId: "codex:mcp-1",
		});
	});

	it("uses item.toolName when provided", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "mcpToolCall", id: "mcp-2", toolName: "read_file" },
		});

		const result = mapCodexEvent(event);

		expect(result[0]).toMatchObject({ toolName: "read_file" });
	});

	it("uses item.toolCallId when provided", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "mcpToolCall", id: "mcp-3", toolCallId: "tc-xyz" },
		});

		const result = mapCodexEvent(event);

		expect(result[0]).toMatchObject({ toolId: "tc-xyz" });
	});
});

describe("mapCodexEvent — item.started / fileChange", () => {
	it("returns a tool_start event with default toolName 'fileChange'", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "fileChange", id: "fc-1" },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject<Partial<OmniEvent>>({
			type: "tool_start",
			toolName: "fileChange",
			toolId: "codex:fc-1",
		});
	});

	it("uses item.toolName when provided", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "fileChange", id: "fc-2", toolName: "patch_file" },
		});

		const result = mapCodexEvent(event);

		expect(result[0]).toMatchObject({ toolName: "patch_file" });
	});

	it("uses item.toolCallId when provided", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "fileChange", id: "fc-3", toolCallId: "call-fc-1" },
		});

		const result = mapCodexEvent(event);

		expect(result[0]).toMatchObject({ toolId: "call-fc-1" });
	});
});

describe("mapCodexEvent — item.started / unknown item type", () => {
	it("returns an empty array for an unrecognised item type", () => {
		const event = makeEvent({
			type: "item.started",
			item: { type: "unknownFutureType", id: "u-1" },
		});

		expect(mapCodexEvent(event)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// item/agentMessage/delta
// ---------------------------------------------------------------------------

describe("mapCodexEvent — item/agentMessage/delta", () => {
	it("returns a text_delta event with the delta text", () => {
		const event = makeEvent({
			type: "item/agentMessage/delta",
			delta: "Hello, world!",
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual<OmniEvent>({ type: "text_delta", text: "Hello, world!" });
	});

	it("preserves an empty string delta", () => {
		const event = makeEvent({ type: "item/agentMessage/delta", delta: "" });

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual<OmniEvent>({ type: "text_delta", text: "" });
	});
});

// ---------------------------------------------------------------------------
// item.completed — agentMessage (camelCase, legacy)
// ---------------------------------------------------------------------------

describe("mapCodexEvent — item.completed / agentMessage", () => {
	it("returns [text_delta, message_end] when content is present", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "agentMessage", id: "msg-10", content: "Final answer." },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual<OmniEvent>({ type: "text_delta", text: "Final answer." });
		const ev = result[1] as Extract<OmniEvent, { type: "message_end" }>;
		expect(ev.type).toBe("message_end");
		expect(ev.message.id).toBe("msg-10");
		expect(ev.message.role).toBe("assistant");
		expect(ev.message.content).toEqual([{ type: "text", text: "Final answer." }]);
	});

	it("returns only [message_end] with empty content when item.content is absent", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "agentMessage", id: "msg-11" },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		const ev = result[0] as Extract<OmniEvent, { type: "message_end" }>;
		expect(ev.message.content).toEqual([]);
	});

	it("returns only [message_end] with empty content when item.content is an empty string", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "agentMessage", id: "msg-12", content: "" },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		const ev = result[0] as Extract<OmniEvent, { type: "message_end" }>;
		expect(ev.message.content).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// item.completed — agent_message (snake_case, live SDK ≥0.104)
// ---------------------------------------------------------------------------

describe("mapCodexEvent — item.completed / agent_message (snake_case)", () => {
	it("returns [text_delta, message_end] using the 'text' field (live SDK format)", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "agent_message", id: "msg-20", text: "HELLO from agent_message." },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual<OmniEvent>({ type: "text_delta", text: "HELLO from agent_message." });
		const ev = result[1] as Extract<OmniEvent, { type: "message_end" }>;
		expect(ev.type).toBe("message_end");
		expect(ev.message.id).toBe("msg-20");
		expect(ev.message.role).toBe("assistant");
		expect(ev.message.content).toEqual([{ type: "text", text: "HELLO from agent_message." }]);
	});

	it("prefers 'text' over 'content' when both are present", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "agent_message", id: "msg-21", text: "from text", content: "from content" },
		});

		const result = mapCodexEvent(event);

		expect(result[0]).toEqual<OmniEvent>({ type: "text_delta", text: "from text" });
	});

	it("falls back to 'content' when 'text' is absent", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "agent_message", id: "msg-22", content: "fallback content" },
		});

		const result = mapCodexEvent(event);

		expect(result[0]).toEqual<OmniEvent>({ type: "text_delta", text: "fallback content" });
	});

	it("returns only [message_end] with empty content when both text and content are absent", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "agent_message", id: "msg-23" },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		const ev = result[0] as Extract<OmniEvent, { type: "message_end" }>;
		expect(ev.message.content).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// item.completed — commandExecution
// ---------------------------------------------------------------------------

describe("mapCodexEvent — item.completed / commandExecution", () => {
	it("returns a tool_end event with isError false by default", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "commandExecution", id: "cmd-10", output: "stdout text" },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject<Partial<OmniEvent>>({
			type: "tool_end",
			toolId: "codex:cmd-10",
			output: "stdout text",
			isError: false,
		});
	});

	it("sets isError true when item.isError is true", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "commandExecution", id: "cmd-11", output: "error output", isError: true },
		});

		const result = mapCodexEvent(event);

		expect((result[0] as Extract<OmniEvent, { type: "tool_end" }>).isError).toBe(true);
	});

	it("uses item.toolCallId as toolId when provided", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "commandExecution", id: "cmd-12", toolCallId: "call-99" },
		});

		const result = mapCodexEvent(event);

		expect((result[0] as Extract<OmniEvent, { type: "tool_end" }>).toolId).toBe("call-99");
	});
});

// ---------------------------------------------------------------------------
// item.completed — mcpToolCall
// ---------------------------------------------------------------------------

describe("mapCodexEvent — item.completed / mcpToolCall", () => {
	it("returns a tool_end event with isError false by default", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "mcpToolCall", id: "mcp-10", output: { result: 42 } },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject<Partial<OmniEvent>>({
			type: "tool_end",
			toolId: "codex:mcp-10",
			output: { result: 42 },
			isError: false,
		});
	});

	it("sets isError true when item.isError is true", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "mcpToolCall", id: "mcp-11", isError: true },
		});

		const result = mapCodexEvent(event);

		expect((result[0] as Extract<OmniEvent, { type: "tool_end" }>).isError).toBe(true);
	});

	it("uses item.toolCallId as toolId when provided", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "mcpToolCall", id: "mcp-12", toolCallId: "call-mcp-7" },
		});

		const result = mapCodexEvent(event);

		expect((result[0] as Extract<OmniEvent, { type: "tool_end" }>).toolId).toBe("call-mcp-7");
	});
});

// ---------------------------------------------------------------------------
// item.completed — fileChange
// ---------------------------------------------------------------------------

describe("mapCodexEvent — item.completed / fileChange", () => {
	it("returns a tool_end event with a file_change output block", () => {
		const event = makeEvent({
			type: "item.completed",
			item: {
				type: "fileChange",
				id: "fc-10",
				path: "src/main.ts",
				operation: "edit",
				diff: "- old\n+ new",
			},
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject<Partial<OmniEvent>>({
			type: "tool_end",
			toolId: "codex:fc-10",
			isError: false,
			output: {
				type: "file_change",
				path: "src/main.ts",
				operation: "edit",
				diff: "- old\n+ new",
			},
		});
	});

	it("defaults path to empty string when item.path is absent", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "fileChange", id: "fc-11" },
		});

		const result = mapCodexEvent(event);
		const ev = result[0] as Extract<OmniEvent, { type: "tool_end" }>;

		expect((ev.output as { path: string }).path).toBe("");
	});

	it("defaults operation to 'edit' when item.operation is absent", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "fileChange", id: "fc-12", path: "foo.ts" },
		});

		const result = mapCodexEvent(event);
		const ev = result[0] as Extract<OmniEvent, { type: "tool_end" }>;

		expect((ev.output as { operation: string }).operation).toBe("edit");
	});

	it("maps a 'create' operation correctly", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "fileChange", id: "fc-13", path: "new.ts", operation: "create" },
		});

		const result = mapCodexEvent(event);
		const ev = result[0] as Extract<OmniEvent, { type: "tool_end" }>;

		expect((ev.output as { operation: string }).operation).toBe("create");
	});

	it("maps a 'delete' operation correctly", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "fileChange", id: "fc-14", path: "old.ts", operation: "delete" },
		});

		const result = mapCodexEvent(event);
		const ev = result[0] as Extract<OmniEvent, { type: "tool_end" }>;

		expect((ev.output as { operation: string }).operation).toBe("delete");
	});

	it("sets isError true when item.isError is true", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "fileChange", id: "fc-15", isError: true },
		});

		const result = mapCodexEvent(event);

		expect((result[0] as Extract<OmniEvent, { type: "tool_end" }>).isError).toBe(true);
	});

	it("passes diff through as undefined when not present", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "fileChange", id: "fc-16", path: "x.ts" },
		});

		const result = mapCodexEvent(event);
		const ev = result[0] as Extract<OmniEvent, { type: "tool_end" }>;

		expect((ev.output as { diff?: string }).diff).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// item.completed — unknown item type
// ---------------------------------------------------------------------------

describe("mapCodexEvent — item.completed / unknown item type", () => {
	it("returns an empty array for an unrecognised item type", () => {
		const event = makeEvent({
			type: "item.completed",
			item: { type: "unknownFutureItem", id: "u-2" },
		});

		expect(mapCodexEvent(event)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// turn.completed
// ---------------------------------------------------------------------------

describe("mapCodexEvent — turn.completed", () => {
	it("returns a turn_end event with full token usage", () => {
		const event = makeEvent({
			type: "turn.completed",
			usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
		});

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual<OmniEvent>({
			type: "turn_end",
			usage: {
				tokens: { input: 100, output: 50, total: 150 },
			},
		});
	});

	it("derives total from inputTokens + outputTokens when totalTokens is absent", () => {
		const event = makeEvent({
			type: "turn.completed",
			usage: { inputTokens: 80, outputTokens: 30 },
		});

		const result = mapCodexEvent(event);
		const ev = result[0] as Extract<OmniEvent, { type: "turn_end" }>;

		expect(ev.usage?.tokens?.total).toBe(110);
	});

	it("defaults missing inputTokens to 0 when computing total", () => {
		const event = makeEvent({
			type: "turn.completed",
			usage: { outputTokens: 40 },
		});

		const result = mapCodexEvent(event);
		const ev = result[0] as Extract<OmniEvent, { type: "turn_end" }>;

		expect(ev.usage?.tokens).toEqual({ input: 0, output: 40, total: 40 });
	});

	it("defaults missing outputTokens to 0 when computing total", () => {
		const event = makeEvent({
			type: "turn.completed",
			usage: { inputTokens: 60 },
		});

		const result = mapCodexEvent(event);
		const ev = result[0] as Extract<OmniEvent, { type: "turn_end" }>;

		expect(ev.usage?.tokens).toEqual({ input: 60, output: 0, total: 60 });
	});

	it("returns usage undefined when event has no usage field", () => {
		const event = makeEvent({ type: "turn.completed" });

		const result = mapCodexEvent(event);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual<OmniEvent>({ type: "turn_end", usage: undefined });
	});
});

// ---------------------------------------------------------------------------
// Unknown event types
// ---------------------------------------------------------------------------

describe("mapCodexEvent — unknown event types", () => {
	it("returns an empty array for a completely unknown event type", () => {
		const event = makeEvent({ type: "some.unknown.event" });

		expect(mapCodexEvent(event)).toEqual([]);
	});

	it("returns an empty array for another unrecognised event", () => {
		const event = makeEvent({ type: "session.created", id: "sess-1" });

		expect(mapCodexEvent(event)).toEqual([]);
	});
});
