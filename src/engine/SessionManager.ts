import type { AgentSession, Message } from "../types";
import { createSession, newSessionId } from "./AgentSession";
import { logger } from "../utils/logger";

/**
 * Owns the lifecycle of AgentSessions: create / list / fork / persist.
 * DeepSeek sessions are persisted via ConversationStore (Phase 1).
 */
export class SessionManager {
  private sessions = new Map<string, AgentSession>();
  private active: AgentSession | undefined;

  constructor() {}

  create(title?: string): AgentSession {
    const s = createSession(title);
    this.sessions.set(s.id, s);
    this.active = s;
    logger.debug("session created", s.id);
    return s;
  }

  /** Bring back a previously persisted session into the in-memory map. */
  restore(session: AgentSession): AgentSession {
    this.sessions.set(session.id, session);
    if (!this.active) this.active = session;
    return session;
  }

  get(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  activeSession(): AgentSession | undefined {
    if (!this.active) this.active = this.create();
    return this.active;
  }

  list(): AgentSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  fork(from: AgentSession, atMessageIndex: number): AgentSession {
    const branch: AgentSession = {
      id: newSessionId(),
      title: `${from.title} (fork)`,
      messages: from.messages.slice(0, atMessageIndex + 1).map((m) => ({ ...m })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      planMode: from.planMode,
    };
    this.sessions.set(branch.id, branch);
    return branch;
  }

  addMessage(id: string, message: Message): void {
    const s = this.get(id);
    if (!s) return;
    s.messages.push(message);
    s.updatedAt = Date.now();
  }

  delete(id: string): void {
    this.sessions.delete(id);
    if (this.active?.id === id) this.active = undefined;
  }
}