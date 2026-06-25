import { defineTool } from "../ToolDefinition";
import { RiskLevel } from "../../types";

export const WriteFile = defineTool({
  name: "write_file",
  description: "Create or overwrite a note in the vault with the given content.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string" },
      content: { type: "string" },
    },
    required: ["path", "content"],
  },
  riskLevel: RiskLevel.EDIT_DANGER,
  async execute(args, ctx) {
    const path = String(args.path ?? "");
    const content = String(args.content ?? "");
    await ctx.vault.create(path, content).catch(async () => {
      const file = ctx.vault.getAbstractFileByPath(path);
      if (file) await ctx.vault.modify(file as never, content as never);
    });
    return { success: true, data: { path, bytes: content.length } };
  },
});