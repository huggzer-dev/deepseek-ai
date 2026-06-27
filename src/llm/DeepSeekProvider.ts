import { requestUrl } from "obsidian";
import { DEEPSEEK_BASE_URL, MAX_TOKENS_LIMIT, MIN_TOKENS_LIMIT, type ChatCallbacks, type ChatOptions, type ChatResult, type Message, type FIMOptions } from "../types";
import { asRequestError } from "./DeepSeekError";

/** Clamp a value into the API's valid range, logging a warning if it had to move. */
function clampMaxTokens(v: number): number {
  if (!Number.isFinite(v) || v < MIN_TOKENS_LIMIT) return MIN_TOKENS_LIMIT;
  if (v > MAX_TOKENS_LIMIT) return MAX_TOKENS_LIMIT;
  return Math.floor(v);
}

/**
 * DeepSeek LLM provider — direct HTTPS calls to the official endpoint.
 * Uses Obsidian's `requestUrl` for community-plugin review compliance.
 */
export class DeepSeekProvider {
  constructor(private apiKey: string) {}

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  async chat(messages: Message[], opts: ChatOptions, callbacks: ChatCallbacks): Promise<ChatResult> {
    const url = `${DEEPSEEK_BASE_URL}/chat/completions`;
    const body: Record<string, unknown> = {
      model: opts.model,
      messages,
      max_tokens: clampMaxTokens(opts.maxTokens),
      temperature: opts.temperature,
      stream: false,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools;
      body.tool_choice = opts.toolChoice ?? "auto";
    }

    const resp = await requestUrl({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      throw: false,
    });

    if (resp.status >= 400) throw asRequestError(resp.status, resp.text);

    const result = parseChatResponse(resp.text);
    const message = result.message;
    if (typeof message.content === "string" && message.content) {
      callbacks.onTextDelta?.(message.content);
    }
    return result;
  }

  async fim(prompt: string, suffix: string, opts: FIMOptions): Promise<string> {
    const url = `${DEEPSEEK_BASE_URL}/beta/completions`;
    const resp = await requestUrl({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        prompt,
        suffix,
        max_tokens: clampMaxTokens(opts.maxTokens),
        temperature: opts.temperature,
        stream: false,
      }),
      throw: false,
    });
    if (resp.status >= 400) throw asRequestError(resp.status, resp.text);
    return parseFimResponse(resp.text);
  }
}

interface ChatCompletionChoice {
  message?: Message;
  finish_reason?: string;
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function parseChatResponse(text: string): ChatResult {
  const parsed = parseJsonObject(text);
  const data = parsed as ChatCompletionResponse;
  const choice = data.choices?.[0];
  const message = choice?.message ?? { role: "assistant", content: "" };
  return {
    message,
    finishReason: choice?.finish_reason ?? "stop",
    usage: data.usage
      ? {
          promptTokens: Number(data.usage.prompt_tokens ?? 0),
          completionTokens: Number(data.usage.completion_tokens ?? 0),
        }
      : undefined,
  };
}

function parseFimResponse(text: string): string {
  const data = parseJsonObject(text) as { choices?: { text?: string }[] };
  return data.choices?.[0]?.text ?? "";
}

function parseJsonObject(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to empty object.
  }
  return {};
}
