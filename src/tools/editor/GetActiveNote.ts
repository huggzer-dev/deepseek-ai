import { defineTool } from "../ToolDefinition";
import { RiskLevel } from "../../types";

export const GetActiveNote = defineTool({
  name: "get_active_note",
  description: "Return the path and full text of the note currently open in the editor.",
  parameters: { type: "object", properties: {} },
  riskLevel: RiskLevel.READ_ONLY,
  async execute(_args, ctx) {
    const file = ctx.file;
    if (!file) return { success: false, error: "no active note" };
    const content = await ctx.vault.read(file as never);
    return { success: true, data: { path: file.path, content } };
  },
});