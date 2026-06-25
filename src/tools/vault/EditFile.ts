import { defineTool } from "../ToolDefinition";
import { RiskLevel } from "../../types";

export const EditFile = defineTool({
  name: "edit_file",
  description: "Replace a single exact substring in a note. Fails if the substring is not found or appears more than once (ambiguous).",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string" },
      find: { type: "string", description: "Exact text to find." },
      replace: { type: "string", description: "Replacement text." },
    },
    required: ["path", "find", "replace"],
  },
  riskLevel: RiskLevel.EDIT_DANGER,
  async execute(args, ctx) {
    const path = String(args.path ?? "");
    const find = String(args.find ?? "");
    const replace = String(args.replace ?? "");
    const file = ctx.vault.getAbstractFileByPath(path);
    if (!file || !("extension" in file)) return { success: false, error: `not found: ${path}` };
    const content = await ctx.vault.read(file as never);
    const count = content.split(find).length - 1;
    if (count === 0) return { success: false, error: "substring not found" };
    if (count > 1) return { success: false, error: `substring ambiguous (${count} matches)` };
    await ctx.vault.modify(file as never, content.replace(find, replace) as never);
    return { success: true, data: { path } };
  },
});