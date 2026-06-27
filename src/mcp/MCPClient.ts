import { requestUrl } from "obsidian";
import { logger } from "../utils/logger";
import { type MCPToolSchema } from "./MCPToolAdapter";

/**
 * Minimal HTTP MCP client. Community-plugin builds avoid Node.js process APIs,
 * so local process transports are intentionally not included.
 */
export type MCPTransport = "http";
export interface MCPServerConfig {
  name: string;
  transport: MCPTransport;
  commandOrUrl: string;
}

export class MCPClient {
  private httpBase: string | undefined;

  async connect(config: MCPServerConfig): Promise<void> {
    this.httpBase = config.commandOrUrl;
    const resp = await requestUrl({ url: `${this.httpBase}/tools/list`, throw: false });
    if (resp.status >= 400) throw new Error(`MCP http connect failed: ${resp.status}`);
    logger.info("mcp http connected", config.name);
  }

  /** Fetch tool list from the connected server. */
  async listTools(): Promise<MCPToolSchema[]> {
    const resp = await requestUrl({ url: `${this.requireHttpBase()}/tools/list`, throw: false });
    const data = parseJsonObject(resp.text) as { tools?: MCPToolSchema[] };
    return data.tools ?? [];
  }

  /** Call a named MCP tool and return the raw result. */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const resp = await requestUrl({
      url: `${this.requireHttpBase()}/tools/call`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, arguments: args }),
      throw: false,
    });
    const data = parseJsonObject(resp.text) as { error?: unknown; result?: unknown };
    if (data.error) throw new Error(JSON.stringify(data.error));
    return data.result;
  }

  disconnect(): void {
    this.httpBase = undefined;
  }

  private requireHttpBase(): string {
    if (!this.httpBase) throw new Error("MCP client is not connected");
    return this.httpBase;
  }
}

function parseJsonObject(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to empty object.
  }
  return {};
}
