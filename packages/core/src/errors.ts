export type OmniErrorCode =
	| "ABORT"
	| "BUDGET_EXCEEDED"
	| "TURN_LIMIT"
	| "PERMISSION_DENIED"
	| "SESSION_NOT_FOUND"
	| "PROVIDER_ERROR"
	| "CONFIGURATION"
	| "NETWORK"
	| "UNKNOWN";

export class OmniAgentError extends Error {
	readonly provider: string;
	readonly code: OmniErrorCode;
	readonly raw?: unknown;

	constructor(
		message: string,
		options: { provider: string; code: OmniErrorCode; raw?: unknown; cause?: Error },
	) {
		super(message, { cause: options.cause });
		this.name = "OmniAgentError";
		this.provider = options.provider;
		this.code = options.code;
		this.raw = options.raw;
	}
}

export class AbortError extends OmniAgentError {
	constructor(options: { provider: string; raw?: unknown }) {
		super("Operation was aborted", { ...options, code: "ABORT" });
		this.name = "AbortError";
	}
}

export class BudgetExceededError extends OmniAgentError {
	constructor(options: { provider: string; raw?: unknown }) {
		super("Budget limit exceeded", { ...options, code: "BUDGET_EXCEEDED" });
		this.name = "BudgetExceededError";
	}
}

export class AgentNotFoundError extends OmniAgentError {
	constructor(agentName: string) {
		super(`Agent not found: "${agentName}"`, { provider: "manager", code: "CONFIGURATION" });
		this.name = "AgentNotFoundError";
	}
}

export class NoDefaultAgentError extends OmniAgentError {
	constructor() {
		super("No default agent set. Register an agent first or set defaultAgentName.", {
			provider: "manager",
			code: "CONFIGURATION",
		});
		this.name = "NoDefaultAgentError";
	}
}

export class AllAgentsFailedError extends OmniAgentError {
	readonly errors: ReadonlyArray<{ agentName: string; error: Error }>;

	constructor(errors: ReadonlyArray<{ agentName: string; error: Error }>) {
		super(`All agents failed (${errors.length} attempted)`, {
			provider: "manager",
			code: "PROVIDER_ERROR",
		});
		this.name = "AllAgentsFailedError";
		this.errors = errors;
	}
}
