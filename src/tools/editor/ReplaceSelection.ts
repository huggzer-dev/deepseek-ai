import { defineTool } from "../ToolDefinition";
import { RiskLevel } from "../../types";

export const ReplaceSelection = defineTool({
  name: "replace_selection",
  description: "Replace the currently selected text in the active editor with new text. Undoable with Ctrl/Cmd+Z.",
  parameters: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
  riskLevel: RiskLevel.EDIT_SAFE,
  async execute(args, ctx) {
    if (!ctx.editor) return { success: false, error: "no active editor" };
    ctx.editor.replaceSelection(String(args.text ?? ""));
    return { success: true, data: { replaced: true } };
  },
});