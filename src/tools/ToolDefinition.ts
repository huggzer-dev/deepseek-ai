import type { ToolDefinition as ToolDef, RiskLevel, ToolResult } from "../types";

/** Convenience builder so each tool file reads cleanly. */
export function defineTool(
  def: ToolDef,
): ToolDef {
  return def;
}

export { RiskLevel };
export type { ToolResult };