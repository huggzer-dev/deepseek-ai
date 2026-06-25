import { defineTool } from "../ToolDefinition";
import { RiskLevel } from "../../types";

export const ReadFile = defineTool({
  name: "read_file",
  description: "Read the full text content of a note in the vault by path.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Vault-relative path to the note." },
    },
    required: ["path"],
  },
  riskLevel: RiskLevel.READ_ONLY,
  async execute(args, ctx) {
    const path = String(args.path ?? "");
    const file = ctx.vault.getAbstractFileByPath(path);
    if (!file || !("extension" in file)) return { success: false, error: `not found: ${path}` };
    const content = await ctx.vault.read(file as never);
    return { success: true, data: content };
  },
});