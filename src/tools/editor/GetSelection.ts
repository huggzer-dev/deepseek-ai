import { defineTool } from "../ToolDefinition";
import { RiskLevel } from "../../types";

export const GetSelection = defineTool({
  name: "get_selection",
  description: "Return the currently selected text in the active editor, if any.",
  parameters: { type: "object", properties: {} },
  riskLevel: RiskLevel.READ_ONLY,
  async execute(_args, ctx) {
    if (!ctx.editor) return { success: false, error: "no active editor" };
    return { success: true, data: ctx.editor.getSelection() };
  },
});