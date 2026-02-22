import type { OmniAgent, OmniEvent, OmniSession } from "@omni-agent-sdk/core";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ConformanceOptions {
	/** Human-readable name for the describe block. */
	name: string;
	/** Factory called once in beforeAll to produce the agent under test. */
	createAgent: () => Promise<OmniAgent>;
	/** When provided and returns false, the entire suite is skipped. */
	canRun?: () => boolean;
	/** Prompt sent to the agent in every prompt/streaming test. Defaults to "Reply with exactly: HELLO". */
	testPrompt?: string;
	/** Per-test timeout in milliseconds. Defaults to 60_000. */
	timeout?: number;
}

// ---------------------------------------------------------------------------
// Suite implementation
// ---------------------------------------------------------------------------

/**
 * Registers a suite of Vitest conformance tests for any OmniAgent implementation.
 * Relies on Vitest globals (describe, it, beforeAll, afterEach, expect).
 */
export function defineConformanceSuite(options: ConformanceOptions): void {
	const {
		name,
		createAgent,
		canRun,
		testPrompt = "Reply with exactly: HELLO",
		timeout = 60_000,
	} = options;

	const shouldSkip = canRun !== undefined && !canRun();

	const suiteDescribe = shouldSkip ? describe.skip : describe;

	suiteDescribe(name, () => {
		let agent: OmniAgent;
		const sessions: OmniSession[] = [];

		beforeAll(async () => {
			agent = await createAgent();
		});

		afterEach(async () => {
			// Dispose every session created during the test to avoid leaks.
			const pending = sessions.splice(0);
			await Promise.all(pending.map((s) => s.dispose().catch(() => undefined)));
		});

		// -----------------------------------------------------------------------
		// 1. Provider identity
		// -----------------------------------------------------------------------

		it(
			"has non-empty provider string",
			async () => {
				expect(agent.provider).toBeTruthy();
			},
			timeout,
		);

		// -----------------------------------------------------------------------
		// 2. Session creation
		// -----------------------------------------------------------------------

		it(
			"createSession() returns a session",
			async () => {
				const session = await agent.createSession();
				sessions.push(session);
				// id is a string (may be empty before the first prompt for lazy providers)
				expect(typeof session.id).toBe("string");
			},
			timeout,
		);

		// -----------------------------------------------------------------------
		// 3. prompt() returns a valid PromptResult
		// -----------------------------------------------------------------------

		it(
			"prompt() returns valid PromptResult",
			async () => {
				const session = await agent.createSession();
				sessions.push(session);

				const result = await session.prompt({ message: testPrompt });

				expect(typeof result.sessionId).toBe("string");
				expect(Array.isArray(result.messages)).toBe(true);
				expect(typeof result.text).toBe("string");
				expect(result.isError).toBe(false);
				expect(result.usage).toBeDefined();
			},
			timeout,
		);

		// -----------------------------------------------------------------------
		// 4. promptStreaming() yields events in correct order
		// -----------------------------------------------------------------------

		it(
			"promptStreaming() yields events in correct order",
			async () => {
				const session = await agent.createSession();
				sessions.push(session);

				const stream = session.promptStreaming({ message: testPrompt });

				const collected: OmniEvent[] = [];
				for await (const event of stream) {
					collected.push(event);
				}

				const turnEndIndices = collected
					.map((e, i) => (e.type === "turn_end" ? i : -1))
					.filter((i) => i !== -1);

				const textDeltaIndices = collected
					.map((e, i) => (e.type === "text_delta" ? i : -1))
					.filter((i) => i !== -1);

				// Must have at least one turn_end
				expect(turnEndIndices.length).toBeGreaterThanOrEqual(1);

				// Must have at least one text_delta
				expect(textDeltaIndices.length).toBeGreaterThanOrEqual(1);

				// The last turn_end must come after all text_delta events
				const lastTurnEnd = turnEndIndices[turnEndIndices.length - 1] ?? -1;
				const lastTextDelta = textDeltaIndices[textDeltaIndices.length - 1] ?? -1;
				expect(lastTurnEnd).toBeGreaterThan(lastTextDelta);
			},
			timeout,
		);

		// -----------------------------------------------------------------------
		// 5. Messages have valid OmniMessage shape
		// -----------------------------------------------------------------------

		it(
			"messages have valid OmniMessage shape",
			async () => {
				const session = await agent.createSession();
				sessions.push(session);

				const result = await session.prompt({ message: testPrompt });

				for (const message of result.messages) {
					expect(typeof message.id).toBe("string");
					expect(["user", "assistant", "system"]).toContain(message.role);
					expect(Array.isArray(message.content)).toBe(true);
				}
			},
			timeout,
		);

		// -----------------------------------------------------------------------
		// 6. abort() doesn't throw unhandled errors
		// -----------------------------------------------------------------------

		it(
			"abort() doesn't throw unhandled errors",
			async () => {
				const session = await agent.createSession();
				sessions.push(session);

				await expect(session.abort()).resolves.toBeUndefined();
			},
			timeout,
		);

		// -----------------------------------------------------------------------
		// 7. dispose() is idempotent
		// -----------------------------------------------------------------------

		it(
			"dispose() is idempotent",
			async () => {
				await expect(agent.dispose()).resolves.toBeUndefined();
				await expect(agent.dispose()).resolves.toBeUndefined();
			},
			timeout,
		);
	});
}
