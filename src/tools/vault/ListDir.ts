import { defineTool } from "../ToolDefinition";
import { RiskLevel } from "../../types";

export const ListDir = defineTool({
  name: "list_dir",
  description: "List files and sub-folders under a vault directory path. Root is '/'.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path relative to vault root.", default: "/" },
    },
  },
  riskLevel: RiskLevel.READ_ONLY,
  async execute(args, ctx) {
    const path = String(args.path ?? "/");
    const files = ctx.vault.getAllLoadedFiles().filter((f) => {
      const p = f.path;
      if (path === "/") return !p.includes("/");
      return p.startsWith(path + "/") && !p.slice(path.length + 1).includes("/");
    });
    return {
      success: true,
      data: files.map((f) => ({ path: f.path, type: "extension" in f ? "file" : "folder" })),
    };
  },
});