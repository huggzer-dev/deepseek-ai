import type DeepSeekPlugin from "../main";
import type { AgentSession } from "../types";
import { logger } from "../utils/logger";

/**
 * Loads / saves chat sessions alongside the settings object inside Obsidian's
 * single PluginData JSON (`data.json`). Format:
 *   { "settings": {...}, "sessions": [AgentSession, ...] }
 */
export class ConversationStore {
  constructor(private plugin: DeepSeekPlugin) {}

  async loadAll(): Promise<AgentSession[]> {
    const data = ((await this.plugin.loadData()) as { sessions?: AgentSession[] } | null) ?? {};
    const sessions = data.sessions ?? [];
    logger.debug("sessions loaded:", sessions.length);
    return sessions;
  }

  async saveAll(sessions: AgentSession[]): Promise<void> {
    const data = ((await this.plugin.loadData()) as Record<string, unknown> | null) ?? {};
    data.sessions = sessions;
    await this.plugin.saveData(data);
  }

  async saveOne(session: AgentSession): Promise<void> {
    const all = await this.loadAll();
    const idx = all.findIndex((s) => s.id === session.id);
    if (idx >= 0) all[idx] = session;
    else all.push(session);
    await this.saveAll(all);
  }

  async delete(id: string): Promise<void> {
    const all = (await this.loadAll()).filter((s) => s.id !== id);
    await this.saveAll(all);
  }
}