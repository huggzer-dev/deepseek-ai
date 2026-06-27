import { App } from "obsidian";
import type {
  AgentEvent,
  AgentSession,
  ContextInput,
  DeepSeekSettings,
  ToolContext,
  ToolResult,
  ToolCall,
  Message,
} from "../types";
import type { DeepSeekProvider } from "../llm/DeepSeekProvider";
import type { ContextBuilder } from "./ContextBuilder";
import type { ToolRegistry } from "../tools/ToolRegistry";
import { ApprovalModal } from "../ui/ApprovalModal";
import { shouldRequireToolApproval } from "./ApprovalPolicy";

/** Convert a ToolResult into a compact one-line summary string for UI/log use. */
function summarize(result: ToolResult): string {
  if (!result.success) return `error: ${result.error ?? "unknown"}`;
  const data = result.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }
  return String(data ?? "");
}

/** Cap a payload to ~4000 tokens before injecting back into context. */
const MAX_RESULT_CHARS = 16000; // ~4000 chars-per-token heuristic * 4
function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_RESULT_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_RESULT_CHARS) + "\n[truncated]", truncated: true };
}

/**
 * The core ReAct loop.
 *  1. ContextBuilder prepares system + history + user (with @mentions included by caller)
 *  2. Call DeepSeek streaming; emit text deltas as they arrive
 *  3. If the model returns tool_calls, run each (with approval if needed), emit results,
 *     append a `tool` role message per result, then loop back to step 2
 *  4. Stop when there are no more tool_calls or we hit the loop cap.
 */
export class AgentLoop {
  constructor(
    private provider: DeepSeekProvider,
    private contextBuilder: ContextBuilder,
    private settings: DeepSeekSettings,
    private registry: ToolRegistry,
    private app: App,
  ) {}

  async *run(session: AgentSession, input: ContextInput, ctx: ToolContext): AsyncGenerator<AgentEvent, void, unknown> {
    let loops = 0;
    const maxLoops = this.settings.maxAgentLoops;
    const userMessage: Message = { role: "user", content: input.userInput };
    session.messages.push(userMessage);

    while (loops < maxLoops) {
      loops += 1;
      const tools = this.contextBuilder.toolSchemas();
      const history = session.messages.slice(); // snapshot for the request
      const messagesForApi = [history[0], ...history.slice(1)] as Message[];

      let assistantMessage: Message;
      try {
        assistantMessage = await this.streamOnce(messagesForApi, tools, ctx, input);
      } catch (err: unknown) {
        if (ctx.aborted) {
          yield { type: "error", message: "stopped" };
          return;
        }
        yield { type: "error", message: (err as Error).message };
        return;
      }
      session.messages.push(assistantMessage);

      const toolCalls = assistantMessage.tool_calls ?? [];
      if (!toolCalls.length) {
        yield { type: "complete", message: assistantMessage };
        return;
      }

      // Execute each tool call sequentially (keeps approval UX sane).
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch {
          args = { __parseError: tc.function.arguments };
        }
        const tool = this.registry.get(tc.function.name);
        const riskLevel = tool?.riskLevel ?? 0;
        const requiresApproval = shouldRequireToolApproval(riskLevel, this.settings);

        yield { type: "tool_call", id: tc.id, name: tc.function.name, args, riskLevel, requiresApproval };

        if (!tool) {
          const errMsg: Message = { role: "tool", tool_call_id: tc.id, name: tc.function.name, content: "error: unknown tool" };
          session.messages.push(errMsg);
          yield { type: "tool_result", id: tc.id, ok: false, summary: "unknown tool" };
          continue;
        }

        if (requiresApproval && !ctx.aborted) {
          const ok = await new ApprovalModal(this.app, { tool: tool.name, args, riskLevel }, this.settings.language).pick();
          if (!ok) {
            const denied: Message = { role: "tool", tool_call_id: tc.id, name: tool.name, content: "user denied this tool call" };
            session.messages.push(denied);
            yield { type: "tool_result", id: tc.id, ok: false, summary: "denied by user" };
            continue;
          }
        }

        let result: ToolResult;
        try {
          result = await this.registry.execute(tool.name, args, ctx);
        } catch (err: unknown) {
          result = { success: false, error: err instanceof Error ? err.message : String(err) };
        }

        const summary = summarize(result);
        yield { type: "tool_result", id: tc.id, ok: result.success, summary: result.truncated ? summary + " [truncated]" : summary };

        const asText = this.serializeResult(result);
        const truncatedResult = truncate(asText);
        const toolMsg: Message = {
          role: "tool",
          tool_call_id: tc.id,
          name: tool.name,
          content: truncatedResult.text,
        };
        session.messages.push(toolMsg);
      }
      // loop continues…
    }

    yield { type: "error", message: "agent loop cap reached" };
  }

  private serializeResult(result: ToolResult): string {
    if (!result.success) return `error: ${result.error ?? "unknown"}`;
    const data = result.data;
    if (typeof data === "string") return data;
    if (data === undefined) return "ok";
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  private async streamOnce(messages: Message[], tools: ReturnType<ContextBuilder["toolSchemas"]>, ctx: ToolContext, _input: ContextInput): Promise<Message> {
    let partial = "";
    const toolCalls: ToolCall[] = [];
    const result = await this.provider.chat(
      messages,
      {
        model: this.settings.model,
        maxTokens: this.settings.maxTokens,
        temperature: this.settings.temperature,
        tools: tools.length ? tools : undefined,
        toolChoice: tools.length ? "auto" : undefined,
        signal: ctx.signal,
      },
      {
        onTextDelta: (delta) => {
          partial += delta;
          ctx.emitText?.(delta);
        },
        onToolCallDelta: (idx, tc) => {
          if (idx >= 0) toolCalls[idx] = tc as ToolCall;
        },
      },
    );
    void partial;
    return result.message;
  }
}
