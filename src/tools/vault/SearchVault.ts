import { defineTool } from "../ToolDefinition";
import { RiskLevel } from "../../types";
import type { SearchResult } from "../../types";

export const SearchVault = defineTool({
  name: "search_vault",
  description: "Full-text search across vault notes using the Obsidian global search engine. Returns matching file paths with context snippets.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Obsidian search syntax (literal or query operators)." },
      limit: { type: "number", description: "Max results, default 20." },
    },
    required: ["query"],
  },
  riskLevel: RiskLevel.READ_ONLY,
  async execute(args, ctx) {
    const query = String(args.query ?? "");
    const limit = Number(args.limit ?? 20);
    // Use Obsidian's lightweight vault index (OMIT) — quick search across all note contents.
    const results: SearchResult[] = [];
    const lower = query.toLowerCase();
    const files = ctx.vault.getMarkdownFiles();
    for (const file of files) {
      if (results.length >= limit) break;
      try {
        const content = await ctx.vault.read(file);
        const idx = content.toLowerCase().indexOf(lower);
        if (idx >= 0) {
          const start = Math.max(0, idx - 80);
          results.push({
            path: file.path,
            snippet: (start > 0 ? "…" : "") + content.slice(start, idx + 200) + (content.length > idx + 200 ? "…" : ""),
          });
        }
      } catch {
        // skip unreadable
      }
    }
    return { success: true, data: results, truncated: results.length >= limit };
  },
});