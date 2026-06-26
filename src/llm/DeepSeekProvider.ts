import { requestUrl } from "obsidian";
import { DEEPSEEK_BASE_URL, MAX_TOKENS_LIMIT, MIN_TOKENS_LIMIT, type ChatCallbacks, type ChatOptions, type ChatResult, type Message, type FIMOptions } from "../types";
import { StreamParser } from "./StreamParser";
import { asRequestError } from "./DeepSeekError";

/** Clamp a value into the API's valid range, logging a warning if it had to move. */
function clampMaxTokens(v: number): number {
  if (!Number.isFinite(v) || v < MIN_TOKENS_LIMIT) return MIN_TOKENS_LIMIT;
  if (v > MAX_TOKENS_LIMIT) return MAX_TOKENS_LIMIT;
  return Math.floor(v);
}

/**
 * DeepSeek LLM provider — direct HTTPS calls to the official endpoint.
 * Uses `requestUrl` for non-streaming FIM and raw `fetch` for SSE streaming
 * (Obsidian's `requestUrl` does not support streaming bodies).
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
      stream: true,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools;
      body.tool_choice = opts.toolChoice ?? "auto";
    }

    // requestUrl does not support streaming; fall back to fetch for SSE.
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!resp.ok || !resp.body) {
      throw await asError(resp);
    }

    const parser = new StreamParser(callbacks);
    return parser.consume(resp.body);
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
    const data = JSON.parse(resp.text) as { choices?: { text?: string }[] };
    return data.choices?.[0]?.text ?? "";
  }
}

/**
 * Translate a non-2xx response into a human-readable Error.
 * 401 → invalid key · 402 → out of balance · 429 → rate limited · else → raw.
 */
async function asError(resp: Response): Promise<Error> {
  const body = await safeReadText(resp);
  return asRequestError(resp.status, body);
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch (err: unknown) {
    return String(err);
  }
}