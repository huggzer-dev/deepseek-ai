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
      "You are DeepSeek AI, a helpful assistant living inside the user's Obsidian vault.",
      `Respond in ${lang} unless the user asks otherwise.`,
      "You may call tools to read, search and edit notes. Prefer tools over guessing about vault content.",
      "When editing, return the minimal change unless asked to rewrite.",
      "",
      "Available tools:",
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