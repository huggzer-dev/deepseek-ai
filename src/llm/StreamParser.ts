import type { Message, ToolCall, ChatCallbacks, ChatResult } from "../types";

/**
 * Minimal SSE stream parser for DeepSeek (OpenAI-compatible) responses.
 * Walks the ReadableStream byte-by-byte, decodes UTF-8 chunks, splits on
 * `\n\n` data blocks and aggregates tool_calls across deltas.
 */
export class StreamParser {
  private message: Message = { role: "assistant", content: "" };
  private toolCalls: ToolCall[] = [];
  private finishReason = "stop";
  private usage: ChatResult["usage"] | undefined;
  private textDoneEmitted = false;

  constructor(private callbacks: ChatCallbacks) {}

  async consume(stream: ReadableStream<Uint8Array>): Promise<ChatResult> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (block.startsWith("data:")) this.handleDataLine(block.slice(5).trim());
      }
    }
    if (buffer.startsWith("data:")) this.handleDataLine(buffer.slice(5).trim());

    this.emitTextDoneOnce();
    if (this.toolCalls.length) this.message.tool_calls = this.toolCalls;
    if (this.message.content === "" && !this.toolCalls.length) this.message.content = null;

    return { message: this.message, finishReason: this.finishReason, usage: this.usage };
  }

  private handleDataLine(line: string): void {
    if (!line || line === "[DONE]") return;
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(line);
    } catch {
      return;
    }
    const choices = json.choices as unknown[] | undefined;
    const choice = choices?.[0] as Record<string, unknown> | undefined;
    if (choice) {
      if (choice.finish_reason) this.finishReason = String(choice.finish_reason);
      const delta = choice.delta as Record<string, unknown> | undefined;
      if (delta) this.handleDelta(delta);
    }
    const u = json.usage as Record<string, unknown> | undefined;
    if (u) {
      this.usage = {
        promptTokens: Number(u.prompt_tokens ?? 0),
        completionTokens: Number(u.completion_tokens ?? 0),
      };
    }
  }

  private handleDelta(delta: Record<string, unknown>): void {
    // reasoning_content (thinking mode) — surfaced via dedicated event in later phases
    const content = delta.content as string | undefined;
    if (content) {
      this.message.content += content;
      this.callbacks.onTextDelta?.(content);
    }
    const calls = delta.tool_calls as Record<string, unknown>[] | undefined;
    if (calls) {
      for (const c of calls) {
        const i = Number(c.index ?? 0);
        const tc = (this.toolCalls[i] ??= { id: "", type: "function", function: { name: "", arguments: "" } });
        if (c.id) tc.id = String(c.id);
        const fn = c.function as Record<string, unknown>;
        if (fn?.name) tc.function.name += String(fn.name);
        if (fn?.arguments) tc.function.arguments += String(fn.arguments);
        this.callbacks.onToolCallDelta?.(i, tc);
      }
    }
  }

  private emitTextDoneOnce(): void {
    if (this.textDoneEmitted) return;
    this.textDoneEmitted = true;
  }
}