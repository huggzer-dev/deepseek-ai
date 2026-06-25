import { requestUrl } from "obsidian";
import { defineTool } from "../ToolDefinition";
import { RiskLevel } from "../../types";

export const WebFetch = defineTool({
  name: "web_fetch",
  description: "Fetch a URL and return the response body as plain text. Requires explicit user approval per call.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Absolute http(s) URL." },
      maxChars: { type: "number", description: "Truncate output to this many characters. Default 20000." },
    },
    required: ["url"],
  },
  riskLevel: RiskLevel.EXTERNAL,
  async execute(args) {
    const url = String(args.url ?? "");
    const max = Number(args.maxChars ?? 20000);
    const resp = await requestUrl({ url, throw: false });
    if (resp.status >= 400) return { success: false, error: `HTTP ${resp.status}` };
    let text = resp.text;
    let truncated = false;
    if (text.length > max) {
      text = text.slice(0, max);
      truncated = true;
    }
    return { success: true, data: text, truncated };
  },
});