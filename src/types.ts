/**
 * DeepSeek AI Assistant — global type definitions.
 *
 * Every module imports from here so the contracts between the
 * plugin core, the agent engine, the LLM provider, the tool system
 * and the UI layer stay in one place.
 */

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type Language = "zh-CN" | "en";

export type Effort = "low" | "medium" | "high";

export const RiskLevel = {
  READ_ONLY: 0,
  EDIT_SAFE: 1,
  EDIT_DANGER: 2,
  EXTERNAL: 3,
} as const;

export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export interface DeepSeekSettings {
  apiKey: string;
  model: DeepSeekModelId;
  maxTokens: number;
  temperature: number;
  language: Language;
  /** Auto-approve tools up to this risk level. */
  autoApproveRisk: RiskLevel;
  /** Max ReAct loop iterations before stopping. */
  maxAgentLoops: number;
  /** Reasoning effort passed to the deepseek-reasoner family. */
  effort: Effort;
  /** When true, sends every tool call with thinking enabled. */
  yolo: boolean;
}

/** Hard limits from the DeepSeek API (max_tokens is [1, 393216] for v4 models). */
export const MAX_TOKENS_LIMIT = 393216;
export const MIN_TOKENS_LIMIT = 1;
export const DEFAULT_MAX_TOKENS = 8192;

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export const DEEPSEEK_MODELS = [
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash (default)", reasoning: true },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", reasoning: true },
] as const;

export type DeepSeekModelId = (typeof DEEPSEEK_MODELS)[number]["id"];

export const DEFAULT_SETTINGS: DeepSeekSettings = {
  apiKey: "",
  model: "deepseek-v4-flash",
  maxTokens: DEFAULT_MAX_TOKENS,
  temperature: 0.7,
  language: "zh-CN",
  autoApproveRisk: RiskLevel.READ_ONLY,
  maxAgentLoops: 12,
  effort: "high",
  yolo: false,
};

// ---------------------------------------------------------------------------
// LLM messages (OpenAI-compatible)
// ---------------------------------------------------------------------------

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface Message {
  role: MessageRole;
  content: MessageContent;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ChatOptions {
  model: DeepSeekModelId;
  maxTokens: number;
  temperature: number;
  tools?: ToolSchema[];
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  signal?: AbortSignal;
}

export interface FIMOptions {
  model: DeepSeekModelId;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Vision (multimodal) content
// ---------------------------------------------------------------------------

export type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

export type MessageContent = string | null | VisionContentPart[];

export interface ChatCallbacks {
  onTextDelta?: (delta: string) => void;
  onToolCallDelta?: (index: number, partial: Partial<ToolCall>) => void;
}

export interface ChatResult {
  message: Message;
  finishReason: string;
  usage?: { promptTokens: number; completionTokens: number };
}

// ---------------------------------------------------------------------------
// Agent events emitted out of the loop
// ---------------------------------------------------------------------------

export type AgentEvent =
  | { type: "text_delta"; content: string }
  | { type: "text_done" }
  | { type: "thinking_delta"; content: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      args: Record<string, unknown>;
      riskLevel: RiskLevel;
      requiresApproval: boolean;
    }
  | { type: "tool_result"; id: string; ok: boolean; summary: string }
  | { type: "plan"; steps: string[] }
  | { type: "complete"; message: Message }
  | { type: "error"; message: string };

// ---------------------------------------------------------------------------
// Tool system
// ---------------------------------------------------------------------------

export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

export interface SearchResult {
  path: string;
  snippet: string;
}

export interface ToolContext {
  app: import("obsidian").App;
  vault: import("obsidian").Vault;
  workspace: import("obsidian").Workspace;
  editor?: import("obsidian").Editor;
  file?: import("obsidian").TFile;
  /** AbortSignal propagated from the engine. */
  signal?: AbortSignal;
  /** True when stop was requested. Tools can short-circuit. */
  aborted?: boolean;
  /** Emit text deltas back to the UI as provider responses arrive. */
  emitText?: (delta: string) => void;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** Result payload was truncated to fit context window. */
  truncated?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  riskLevel: RiskLevel;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface AgentSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  planMode: boolean;
}

// ---------------------------------------------------------------------------
// Context input (what the UI hands to the engine)
// ---------------------------------------------------------------------------

export interface MentionRef {
  kind: "file" | "folder";
  path: string;
}

export interface ContextInput {
  userInput: string;
  mentions: MentionRef[];
  activeNotePath?: string;
  selection?: string;
  instruction?: string; // # mode
  skill?: string; // $ mode
  /** base64 data-URL images for vision analysis. */
  images?: string[];
}
