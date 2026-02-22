import type {
	OmniAgent,
	OmniEvent,
	OmniSession,
	OmniStream,
	OmniUsage,
	PromptInput,
	PromptResult,
} from "@omni-agent-sdk/core";

// ---------------------------------------------------------------------------
// PromptResult factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock PromptResult with a single assistant text message.
 */
export function makeMockPromptResult(sessionId: string, text: string): PromptResult {
	const usage: OmniUsage = {
		tokens: { input: 0, output: 0, total: 0 },
	};

	return {
		sessionId,
		messages: [
			{
				id: `msg-${sessionId}`,
				role: "assistant",
				content: [{ type: "text", text }],
			},
		],
		text,
		isError: false,
		usage,
	};
}

// ---------------------------------------------------------------------------
// OmniStream factory
// ---------------------------------------------------------------------------

/**
 * Creates a mock OmniStream that yields:
 *   turn_start → text_delta(text) → turn_end
 * and whose result() returns makeMockPromptResult.
 */
export function makeMockStream(sessionId: string, text: string): OmniStream {
	const events: OmniEvent[] = [
		{ type: "turn_start" },
		{ type: "text_delta", text },
		{ type: "turn_end", usage: { tokens: { input: 0, output: 0, total: 0 } } },
	];

	const stream: OmniStream = {
		[Symbol.asyncIterator](): AsyncIterator<OmniEvent> {
			let index = 0;
			return {
				async next(): Promise<IteratorResult<OmniEvent>> {
					if (index < events.length) {
						// biome-ignore lint/style/noNonNullAssertion: index is bounds-checked
						return { value: events[index++]!, done: false };
					}
					return { value: undefined as unknown as OmniEvent, done: true };
				},
			};
		},

		async result(): Promise<PromptResult> {
			return makeMockPromptResult(sessionId, text);
		},

		async abort(): Promise<void> {
			// no-op
		},

		async [Symbol.asyncDispose](): Promise<void> {
			// no-op
		},
	};

	return stream;
}

// ---------------------------------------------------------------------------
// OmniSession factory
// ---------------------------------------------------------------------------

/**
 * Creates a mock OmniSession with the given id.
 * - prompt() resolves with makeMockPromptResult
 * - promptStreaming() returns makeMockStream
 * - abort() and dispose() are no-ops
 */
export function makeMockSession(id: string, text = "mock response"): OmniSession {
	return {
		id,

		async prompt(_input: PromptInput): Promise<PromptResult> {
			return makeMockPromptResult(id, text);
		},

		promptStreaming(_input: PromptInput): OmniStream {
			return makeMockStream(id, text);
		},

		async abort(): Promise<void> {
			// no-op
		},

		async dispose(): Promise<void> {
			// no-op
		},
	};
}

// ---------------------------------------------------------------------------
// OmniAgent factories
// ---------------------------------------------------------------------------

/**
 * Creates a mock OmniAgent with the given providerName.
 * - createSession() resolves with makeMockSession using a generated id
 * - resumeSession(id) resolves with makeMockSession(id)
 * - dispose() is a no-op
 */
export function makeMockAgent(providerName: string): OmniAgent {
	return {
		provider: providerName,

		async createSession(): Promise<OmniSession> {
			const id =
				typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
					? crypto.randomUUID()
					: "session-1";
			return makeMockSession(id);
		},

		async resumeSession(sessionId: string): Promise<OmniSession> {
			return makeMockSession(sessionId);
		},

		async dispose(): Promise<void> {
			// no-op
		},
	};
}

/**
 * Creates a mock OmniAgent whose createSession always rejects with the given error.
 * resumeSession also rejects with the same error.
 */
export function makeFailingMockAgent(providerName: string, error: Error): OmniAgent {
	return {
		provider: providerName,

		async createSession(): Promise<OmniSession> {
			throw error;
		},

		async resumeSession(_sessionId: string): Promise<OmniSession> {
			throw error;
		},

		async dispose(): Promise<void> {
			// no-op
		},
	};
}
