import { RiskLevel } from "../types";
import type { ToolDefinition, ToolContext } from "../types";

export interface MCPToolSchema {
  name: string;
  description?: string;
  inputSchema?: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
}

/** Converts an MCP tool descriptor into our internal ToolDefinition. */
export function adaptMCPTool(tool: MCPToolSchema, executor: (args: Record<string, unknown>) => Promise<unknown>): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description ?? `MCP tool: ${tool.name}`,
    parameters: tool.inputSchema ?? { type: "object", properties: {} },
    riskLevel: RiskLevel.EXTERNAL,
    async execute(args, _ctx: ToolContext) {
      try {
        const data = await executor(args);
        return { success: true, data };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  };
}