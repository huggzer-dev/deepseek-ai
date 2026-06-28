import { MAX_TOKENS_LIMIT, MIN_TOKENS_LIMIT, type ChatOptions, type Message } from "../types";

/** Clamp a value into the API's valid range, logging a warning if it had to move. */
export function clampMaxTokens(v: number): number {
  if (!Number.isFinite(v) || v < MIN_TOKENS_LIMIT) return MIN_TOKENS_LIMIT;
  if (v > MAX_TOKENS_LIMIT) return MAX_TOKENS_LIMIT;
  return Math.floor(v);
}

export function buildChatRequestBody(messages: Message[], opts: ChatOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages,
    max_tokens: clampMaxTokens(opts.maxTokens),
    temperature: opts.temperature,
    stream: false,
  };
  if (opts.effort) body.reasoning_effort = opts.effort;
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice ?? "auto";
  }
  return body;
}
