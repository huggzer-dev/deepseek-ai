import type { ToolDefinition, ToolContext, ToolResult } from "../types";
import { logger } from "../utils/logger";

/**
 * Registry + dispatcher for tools. Tools self-register here; the AgentLoop
 * resolves a tool call by name and runs it with the current ToolContext.
 */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      logger.warn("duplicate tool registration", tool.name);
    }
    this.tools.set(tool.name, tool);
  }

  all(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.get(name);
    if (!tool) return { success: false, error: `unknown tool: ${name}` };
    try {
      return await tool.execute(args, ctx);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}