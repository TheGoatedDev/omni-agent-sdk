import type { OmniSession } from "./session.js";

export interface SessionInfo {
	id: string;
	createdAt?: Date;
	metadata?: Record<string, unknown>;
}

export interface CreateSessionOptions {
	cwd?: string;
	providerOptions?: Record<string, unknown>;
}

export interface ResumeSessionOptions {
	cwd?: string;
	providerOptions?: Record<string, unknown>;
}

export interface OmniAgent {
	readonly provider: string;
	createSession(options?: CreateSessionOptions): Promise<OmniSession>;
	resumeSession(sessionId: string, options?: ResumeSessionOptions): Promise<OmniSession>;
	listSessions?(): Promise<SessionInfo[]>;
	dispose(): Promise<void>;
}
