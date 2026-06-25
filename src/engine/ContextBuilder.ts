import type {
  Message,
  ContextInput,
  ToolSchema,
  DeepSeekSettings,
  ToolDefinition,
} from "../types";

/**
 * Builds the message list handed to the LLM on every loop turn.
 * Packs the system prompt, history, @mention file contents and the
 * current selection in state.
 */
export class ContextBuilder {
  constructor(
    private settings: DeepSeekSettings,
    private tools: ToolDefinition[],
  ) {}

  buildSystemPrompt(): string {
    const lang = this.settings.language === "zh-CN" ? "中文" : "English";
    const toolList = this.tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");
    return [
      "## Identity (CRITICAL — read first)",
      "You are DeepSeek AI (深度求索), a large language model created by DeepSeek AI Inc. (deepseek.com).",
      "You are running as an Obsidian plugin called 'deepseek-ai'.",
      "If asked who you are, you MUST say: '我是 DeepSeek AI，由深度求索公司开发。' (Chinese) or 'I am DeepSeek AI, made by DeepSeek Inc.' (English).",
      "You are NOT Claude, NOT GPT, NOT Gemini, NOT made by Anthropic, OpenAI, or Google. Never claim to be any other AI.",
      "",
      "## Behavior",
      `Respond in ${lang} unless the user asks otherwise.`,
      "You may call tools to read, search and edit notes. Prefer tools over guessing about vault content.",
      "When editing, return the minimal change unless asked to rewrite.",
      "Be concise and helpful.",
      "",
      "## Available tools",
      toolList,
    ].join("\n");
  }

  toolSchemas(): ToolSchema[] {
    return this.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  buildMessages(history: Message[], input: ContextInput, extraContext: string[] = []): Message[] {
    const system: Message = { role: "system", content: this.buildSystemPrompt() };
    const userContent = [input.userInput, ...extraContext].filter(Boolean).join("\n\n");
    const user: Message = { role: "user", content: userContent };
    return [system, ...history, user];
  }
}