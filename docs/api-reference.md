# API Reference

All types are exported from `@omni-agent-sdk/core` unless noted otherwise.

---

## Type Aliases

### `JsonSchema`

```typescript
type JsonSchema = Record<string, unknown>;
```

### `OmniErrorCode`

```typescript
type OmniErrorCode =
  | "ABORT"
  | "BUDGET_EXCEEDED"
  | "TURN_LIMIT"
  | "PERMISSION_DENIED"
  | "SESSION_NOT_FOUND"
  | "PROVIDER_ERROR"
  | "CONFIGURATION"
  | "NETWORK"
  | "UNKNOWN";
```

---

## Interfaces

### `OmniAgentConfig`

```typescript
interface OmniAgentConfig {
  model?: string;
  permissions?: OmniPermissionPolicy;
  cwd?: string;
  systemPrompt?: string;
  maxBudgetUsd?: number;
  maxTurns?: number;
  tools?: {
    allowed?: string[];
    disallowed?: string[];
  };
  mcpServers?: Record<string, OmniMcpServerConfig>;
  env?: Record<string, string>;
  providerOptions?: Record<string, unknown>;
}
```

### `OmniPermissionPolicy`

```typescript
type OmniPermissionPolicy =
  | "auto-approve"
  | "approve-edits"
  | "ask"
  | "plan-only"
  | { canUseTool: (req: ToolPermissionRequest) => Promise<"allow" | "deny" | "ask"> };
```

### `ToolPermissionRequest`

```typescript
interface ToolPermissionRequest {
  toolName: string;
  input?: unknown;
  sessionId: string;
}
```

### `OmniMcpServerConfig`

```typescript
interface OmniMcpServerConfig {
  command?: string;  // stdio server: executable path
  args?: string[];   // arguments passed to the process
  env?: Record<string, string>;  // environment variables for the server process
  url?: string;      // URL server: HTTP/SSE endpoint
}
```

### `OmniAgent`

```typescript
interface OmniAgent {
  readonly provider: string;
  createSession(options?: CreateSessionOptions): Promise<OmniSession>;
  resumeSession(sessionId: string, options?: ResumeSessionOptions): Promise<OmniSession>;
  listSessions?(): Promise<SessionInfo[]>;
  dispose(): Promise<void>;
}
```

### `CreateSessionOptions`

```typescript
interface CreateSessionOptions {
  cwd?: string;
  providerOptions?: Record<string, unknown>;
}
```

### `ResumeSessionOptions`

```typescript
interface ResumeSessionOptions {
  cwd?: string;
  providerOptions?: Record<string, unknown>;
}
```

### `SessionInfo`

```typescript
interface SessionInfo {
  id: string;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}
```

### `OmniSession`

```typescript
interface OmniSession {
  readonly id: string;
  /** Collect all events and return the final result. */
  prompt(input: PromptInput): Promise<PromptResult>;
  /** Returns a stream of events. Iterate with for-await or call .result() for the full result. */
  promptStreaming(input: PromptInput): OmniStream;
  abort(): Promise<void>;
  dispose(): Promise<void>;
}
```

### `PromptInput`

```typescript
interface PromptInput {
  message: string;
  model?: string;
  systemPrompt?: string;
  outputSchema?: JsonSchema;
  maxTurns?: number;
  maxBudgetUsd?: number;
  signal?: AbortSignal;
  providerOptions?: Record<string, unknown>;
}
```

### `PromptResult`

```typescript
interface PromptResult {
  sessionId: string;
  messages: OmniMessage[];
  text: string;           // convenience: final text response
  isError: boolean;
  structuredOutput?: unknown;
  usage: OmniUsage;
  raw?: unknown;
}
```

### `OmniMessage`

```typescript
interface OmniMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: OmniContentBlock[];
  createdAt?: Date;
  raw?: unknown;
}
```

### `OmniContentBlock`

```typescript
type OmniContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; toolName: string; toolId: string; input: unknown }
  | { type: "tool_result"; toolId: string; output: unknown; isError: boolean }
  | { type: "reasoning"; text: string }
  | {
      type: "file_change";
      path: string;
      operation: "create" | "edit" | "delete";
      diff?: string;
    };
```

### `OmniStream`

```typescript
interface OmniStream extends AsyncDisposable {
  [Symbol.asyncIterator](): AsyncIterator<OmniEvent>;
  result(): Promise<PromptResult>;
  abort(): Promise<void>;
}
```

### `OmniEvent`

```typescript
type OmniEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; toolName: string; toolId: string; input?: unknown }
  | { type: "tool_end"; toolId: string; output?: unknown; isError: boolean }
  | { type: "message_start"; role: "assistant" | "system" }
  | { type: "message_end"; message: OmniMessage }
  | { type: "turn_start" }
  | { type: "turn_end"; usage?: OmniUsage }
  | { type: "error"; error: OmniAgentError };
```

### `OmniUsage`

```typescript
interface OmniUsage {
  totalCostUsd?: number;
  durationMs?: number;
  tokens?: OmniTokenUsage;
  numTurns?: number;
}
```

### `OmniTokenUsage`

```typescript
interface OmniTokenUsage {
  input: number;
  output: number;
  total: number;
}
```

---

## Error Classes

All error classes extend `OmniAgentError`.

### `OmniAgentError`

```typescript
class OmniAgentError extends Error {
  readonly provider: string;
  readonly code: OmniErrorCode;
  readonly raw?: unknown;

  constructor(
    message: string,
    options: { provider: string; code: OmniErrorCode; raw?: unknown; cause?: Error }
  );
}
```

### `AbortError`

```typescript
class AbortError extends OmniAgentError {
  constructor(options: { provider: string; raw?: unknown });
  // code is always "ABORT"
}
```

### `BudgetExceededError`

```typescript
class BudgetExceededError extends OmniAgentError {
  constructor(options: { provider: string; raw?: unknown });
  // code is always "BUDGET_EXCEEDED"
}
```

### `AgentNotFoundError`

```typescript
class AgentNotFoundError extends OmniAgentError {
  constructor(agentName: string);
  // provider: "manager", code: "CONFIGURATION"
}
```

### `NoDefaultAgentError`

```typescript
class NoDefaultAgentError extends OmniAgentError {
  constructor();
  // provider: "manager", code: "CONFIGURATION"
}
```

### `AllAgentsFailedError`

```typescript
class AllAgentsFailedError extends OmniAgentError {
  readonly errors: ReadonlyArray<{ agentName: string; error: Error }>;
  constructor(errors: ReadonlyArray<{ agentName: string; error: Error }>);
  // provider: "manager", code: "PROVIDER_ERROR"
}
```

---

## `AgentManager`

Exported from `@omni-agent-sdk/core`. Implements `OmniAgent`.

```typescript
interface FallbackConfig {
  enabled: boolean;
  order?: string[];
  shouldFallback?: (error: OmniAgentError) => boolean;
}

interface AgentManagerConfig {
  defaultAgent?: string;
  fallback?: FallbackConfig;
}

class AgentManager implements OmniAgent {
  readonly provider = "manager";

  constructor(config?: AgentManagerConfig);

  // Registry
  register(name: string, agent: OmniAgent): this;
  unregister(name: string): boolean;
  agent(name: string): OmniAgent;           // throws AgentNotFoundError
  tryAgent(name: string): OmniAgent | undefined;
  has(name: string): boolean;
  agentNames(): readonly string[];
  get size(): number;
  [Symbol.iterator](): Iterator<[string, OmniAgent]>;

  // Default management
  get defaultAgentName(): string | undefined;
  set defaultAgentName(name: string);

  // OmniAgent — delegates to default agent (or uses fallback if configured)
  createSession(options?: CreateSessionOptions): Promise<OmniSession>;
  resumeSession(sessionId: string, options?: ResumeSessionOptions): Promise<OmniSession>;
  dispose(): Promise<void>;

  // Explicit routing
  createSessionOn(agentName: string, options?: CreateSessionOptions): Promise<OmniSession>;

  // Generic fallback
  withFallback<T>(
    fn: (agent: OmniAgent, name: string) => Promise<T>,
    order?: string[]
  ): Promise<T>;
}
```

---

## Factory Functions

### `createAgent` — Claude

Exported from `@omni-agent-sdk/provider-claude`.

```typescript
function createAgent(config: ClaudeAgentConfig): ClaudeAgent;
```

### `createAgent` — Codex

Exported from `@omni-agent-sdk/provider-codex`.

```typescript
function createAgent(config: CodexAgentConfig): CodexAgent;
```

### `createAgent` — OpenCode

Exported from `@omni-agent-sdk/provider-opencode`.

```typescript
function createAgent(config: OpenCodeAgentConfig): OpenCodeAgent;
```

---

## Provider Types

### `ClaudeAgentConfig`

Exported from `@omni-agent-sdk/provider-claude`.

```typescript
interface ClaudeProviderOptions {
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan";
  enableFileCheckpointing?: boolean;
  executable?: string;
  settingSources?: string[];
  betas?: string[];
}

interface ClaudeAgentConfig extends OmniAgentConfig {
  providerOptions?: ClaudeProviderOptions & Record<string, unknown>;
}
```

### `CodexAgentConfig`

Exported from `@omni-agent-sdk/provider-codex`.

```typescript
interface CodexProviderOptions {
  approvalPolicy?: "never" | "on-request" | "untrusted" | "read-only";
  sandboxMode?: string;
  skipGitRepoCheck?: boolean;
  modelReasoningEffort?: "low" | "medium" | "high";
  features?: Record<string, boolean>;
}

interface CodexAgentConfig extends OmniAgentConfig {
  providerOptions?: CodexProviderOptions & Record<string, unknown>;
}
```

### `OpenCodeAgentConfig`

Exported from `@omni-agent-sdk/provider-opencode`.

```typescript
interface OpenCodeProviderOptions {
  baseUrl?: string;      // connect to existing server (client-only mode)
  hostname?: string;     // embedded server hostname (default: "127.0.0.1")
  port?: number;         // embedded server port (default: 4096)
  timeout?: number;      // server startup timeout ms (default: 5000)
  agent?: string;        // OpenCode agent name (e.g. "coder")
  providerID?: string;   // override parsed providerID from model string
  modelID?: string;      // override parsed modelID from model string
}

interface OpenCodeAgentConfig extends OmniAgentConfig {
  providerOptions?: OpenCodeProviderOptions & Record<string, unknown>;
}
```
