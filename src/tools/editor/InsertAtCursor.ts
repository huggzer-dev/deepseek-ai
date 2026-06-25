import { defineTool } from "../ToolDefinition";
import { RiskLevel } from "../../types";

export const InsertAtCursor = defineTool({
  name: "insert_at_cursor",
  description: "Insert text at the current cursor position in the active editor.",
  parameters: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
  riskLevel: RiskLevel.EDIT_SAFE,
  async execute(args, ctx) {
    if (!ctx.editor) return { success: false, error: "no active editor" };
    ctx.editor.replaceSelection(String(args.text ?? ""));
    return { success: true, data: { inserted: true } };
  },
});