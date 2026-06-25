import { requestUrl } from "obsidian";
import { logger } from "../utils/logger";
import { type MCPToolSchema } from "./MCPToolAdapter";

/**
 * Minimal MCP client supporting stdio + HTTP transports.
 * Desktop only (relies on child_process for stdio). Mobile falls through gracefully.
 * Protocol format: JSON-RPC 2.0.
 */
export type MCPTransport = "stdio" | "http";
export interface MCPServerConfig { name: string; transport: MCPTransport; commandOrUrl: string; args?: string[]; env?: Record<string, string>; }

interface PendingCall { resolve: (r: unknown) => void; reject: (e: Error) => void; }

export class MCPClient {
  private pending = new Map<number, PendingCall>();
  private nextId = 1;

  async connect(config: MCPServerConfig): Promise<void> {
    if (config.transport === "http") {
      this.httpBase = config.commandOrUrl;
      // Test reachability.
      const resp = await requestUrl({ url: `${this.httpBase}/tools/list`, throw: false });
      if (resp.status >= 400) throw new Error(`MCP http connect failed: ${resp.status}`);
      logger.info("mcp http connected", config.name);
      return;
    }
    // stdio path: require child_process only on desktop.
    try {
      const { spawn } = await import("child_process");
      const child = spawn(config.commandOrUrl, config.args ?? [], { env: config.env ?? process.env, stdio: ["pipe", "pipe", "pipe"] });
      child.stdout.on("data", (buf: Buffer) => this.onData(buf));
      child.stderr.on("data", (buf: Buffer) => logger.warn("mcp stderr", config.name, buf.toString()));
      child.on("close", (code) => logger.info("mcp child closed", config.name, code));
      this.process = child;
    } catch {
      logger.warn("stdio MCP unavailable (likely mobile or missing child_process)");
    }
    this.buffer = "";
  }

  /** Fetch tool list from the connected server. */
  async listTools(): Promise<MCPToolSchema[]> {
    if (this.httpBase) {
      const resp = await requestUrl({ url: `${this.httpBase}/tools/list`, throw: false });
      const data = JSON.parse(resp.text) as { tools: MCPToolSchema[] };
      return data.tools ?? [];
    }
    const result = (await this.call("tools/list", {})) as { tools: MCPToolSchema[] };
    return result.tools ?? [];
  }

  /** Call a named MCP tool and return the raw result. */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (this.httpBase) {
      const resp = await requestUrl({
        url: `${this.httpBase}/tools/call`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, arguments: args }),
        throw: false,
      });
      const data = JSON.parse(resp.text) as { error?: unknown; result?: unknown };
      if (data.error) throw new Error(JSON.stringify(data.error));
      return data.result;
    }
    const result = (await this.call("tools/call", { name, arguments: args }));
    return (result as Record<string, unknown>).result ?? result;
  }

  disconnect(): void {
    this.process?.kill();
    this.process = undefined;
    this.httpBase = undefined;
    this.buffer = "";
    this.pending.clear();
  }

  // ---- internal ----
  private process: ReturnType<typeof import("child_process").spawn> | undefined;
  private buffer: string = "";
  private httpBase?: string;

  private onData(buf: Buffer): void {
    this.buffer += buf.toString();
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as { id?: number; error?: unknown; result?: unknown };
        const id = msg.id;
        if (id !== undefined && this.pending.has(id)) {
          const p = this.pending.get(id)!;
          this.pending.delete(id);
          if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
          else p.resolve(msg.result);
        }
      } catch (err: unknown) { void err; /* ignore partial */ }
    }
  }

  private call(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const stdin = this.process?.stdin;
      if (stdin) stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      // Safety timeout for missing response.
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP timeout: ${method}`));
        }
      }, 15000);
    });
  }
}