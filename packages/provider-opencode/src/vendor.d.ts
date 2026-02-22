/**
 * Minimal type declarations for @opencode-ai/sdk.
 *
 * The package is a peer dependency and may not be installed during type-checking,
 * so we declare the subset of types required by this provider implementation.
 * These declarations must remain in sync with the upstream SDK.
 */
declare module "@opencode-ai/sdk" {
	// ---- Content Parts ----

	export interface TextPart {
		type: "text";
		text: string;
		/** Text delta for streaming events. Present on EventMessagePartUpdated. */
		delta?: string;
	}

	export interface ToolPart {
		type: "tool";
		toolName: string;
		toolID: string;
		input?: unknown;
		output?: unknown;
		error?: string;
		state: "pending" | "running" | "completed" | "error";
	}

	export interface ReasoningPart {
		type: "reasoning";
		text: string;
		/** Reasoning delta for streaming events. */
		delta?: string;
	}

	export interface FilePart {
		type: "file";
		path: string;
		mime?: string;
	}

	export type Part = TextPart | ToolPart | ReasoningPart | FilePart;

	// ---- Messages ----

	export interface Message {
		id: string;
		role: "user" | "assistant";
		parts: Part[];
		createdAt?: number;
		usage?: {
			inputTokens?: number;
			outputTokens?: number;
			totalTokens?: number;
			costUsd?: number;
		};
	}

	// ---- Sessions ----

	export interface OpenCodeSessionInfo {
		id: string;
		title?: string;
		createdAt?: number;
		updatedAt?: number;
	}

	// ---- Prompt types ----

	export interface PromptBody {
		/** The user message text. */
		message: string;
		/** Provider ID (e.g. "anthropic", "openai"). */
		providerID?: string;
		/** Model ID (e.g. "claude-3-5-sonnet-20241022"). */
		modelID?: string;
		/** OpenCode agent name to use. */
		agent?: string;
		/** System prompt override. */
		system?: string;
		/** Allowed tool names. */
		tools?: string[];
	}

	export interface PromptResponse {
		sessionID: string;
		messages: Message[];
	}

	// ---- SSE Events ----

	/** Emitted when a message part is created or updated during streaming. */
	export interface EventMessagePartUpdated {
		type: "message.part.updated";
		sessionID: string;
		messageID: string;
		part: Part;
	}

	/** Emitted when a message is created or completed. */
	export interface EventMessageUpdated {
		type: "message.updated";
		sessionID: string;
		message: Message;
	}

	/** Emitted when a session finishes processing and returns to idle state. */
	export interface EventSessionIdle {
		type: "session.idle";
		sessionID: string;
	}

	/** Emitted when a session encounters an unrecoverable error. */
	export interface EventSessionError {
		type: "session.error";
		sessionID: string;
		error: string;
	}

	/** Emitted for general session status changes (e.g. "running", "loading"). */
	export interface EventSessionStatus {
		type: "session.status";
		sessionID: string;
		status: string;
	}

	/** Catch-all for future or unknown event types. */
	export interface OpenCodeEventUnknown {
		type: string & {};
		sessionID?: string;
	}

	export type OpenCodeEvent =
		| EventMessagePartUpdated
		| EventMessageUpdated
		| EventSessionIdle
		| EventSessionError
		| EventSessionStatus
		| OpenCodeEventUnknown;

	// ---- Client ----

	export interface OpenCodeClient {
		session: {
			create(): Promise<OpenCodeSessionInfo>;
			get(sessionId: string): Promise<OpenCodeSessionInfo>;
			list(): Promise<OpenCodeSessionInfo[]>;
			/** Synchronous prompt: blocks until the agent finishes responding. */
			prompt(sessionId: string, body: PromptBody): Promise<PromptResponse>;
			/** Async prompt: fires the request and returns immediately; events arrive via SSE. */
			promptAsync(sessionId: string, body: PromptBody): Promise<void>;
			abort(sessionId: string): Promise<void>;
		};
		event: {
			/** Subscribe to the global SSE event stream. Filter by sessionID for session-specific events. */
			subscribe(): AsyncIterable<OpenCodeEvent>;
		};
	}

	// ---- Factory functions ----

	export interface EmbeddedServerOptions {
		hostname?: string;
		port?: number;
		/** Server startup timeout in milliseconds. */
		timeout?: number;
		/** Additional server configuration. */
		config?: Record<string, unknown>;
	}

	export interface EmbeddedServer {
		client: OpenCodeClient;
		/** Shut down the embedded server. */
		dispose(): Promise<void>;
	}

	export interface ClientOnlyOptions {
		baseUrl: string;
	}

	/** Start an embedded OpenCode server and return a client connected to it. */
	export function createOpencode(options?: EmbeddedServerOptions): Promise<EmbeddedServer>;

	/** Connect to an existing OpenCode server at the given base URL. */
	export function createOpencodeClient(options: ClientOnlyOptions): OpenCodeClient;
}
