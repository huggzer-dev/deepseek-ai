import { DEEPSEEK_BASE_URL, type ChatCallbacks, type ChatOptions, type ChatResult, type Message, type FIMOptions } from "../types";
import { StreamParser } from "./StreamParser";

/**
 * DeepSeek LLM provider — direct HTTPS calls to the official endpoint.
 * No SDK dependency; uses raw `fetch` + ReadableStream for SSE streaming.
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
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      stream: true,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools;
      body.tool_choice = opts.toolChoice ?? "auto";
    }

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
      throw new Error(`DeepSeek API ${resp.status}: ${await safeReadText(resp)}`);
    }

    const parser = new StreamParser(callbacks);
    return parser.consume(resp.body);
  }

  async fim(prompt: string, suffix: string, opts: FIMOptions): Promise<string> {
    const url = `${DEEPSEEK_BASE_URL}/beta/completions`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        prompt,
        suffix,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        stream: false,
      }),
      signal: opts.signal,
    });
    if (!resp.ok) throw new Error(`DeepSeek FIM ${resp.status}: ${await safeReadText(resp)}`);
    const data = await resp.json();
    return (data.choices?.[0]?.text ?? "") as string;
  }
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}