import { Notice } from "obsidian";
import { MCPClient, type MCPServerConfig } from "./MCPClient";
import { adaptMCPTool } from "./MCPToolAdapter";
import type { ToolRegistry } from "../tools/ToolRegistry";
import type { ToolDefinition } from "../types";
import { logger } from "../utils/logger";

/** Owns MCP client lifecycle and registers discovered tools into ToolRegistry. */
export class MCPManager {
  private clients = new Map<string, MCPClient>();
  private registeredTools = new Map<string, ToolDefinition[]>();

  constructor(private registry: ToolRegistry) {}

  async addServer(config: MCPServerConfig): Promise<void> {
    const client = new MCPClient();
    await client.connect(config);
    this.clients.set(config.name, client);
    const schemas = await client.listTools();
    logger.info("mcp tools found", config.name, schemas.length);
    const tools: ToolDefinition[] = [];
    for (const s of schemas) {
      const tool = adaptMCPTool(s, async (args) => {
        return client.callTool(s.name, args);
      });
      this.registry.register(tool);
      tools.push(tool);
    }
    this.registeredTools.set(config.name, tools);
    new Notice(`MCP connected: ${config.name} (${tools.length} tools)`);
  }

  async removeServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (!client) return;
    client.disconnect();
    this.clients.delete(name);
    // Note: we don't remove registered tools from registry (idempotency); users restart to clear.
    new Notice(`MCP disconnected: ${name}`);
  }

  list(): string[] {
    return Array.from(this.clients.keys());
  }
}