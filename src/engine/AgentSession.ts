import type { AgentSession, Message } from "../types";

/** Unique id generator (good enough for client-side session ids). */
export function newSessionId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createSession(title = "New chat"): AgentSession {
  const now = Date.now();
  return {
    id: newSessionId(),
    title,
    messages: [] as Message[],
    createdAt: now,
    updatedAt: now,
    planMode: false,
  };
}

/** Append a message and stamp updated time. */
export function pushMessage(session: AgentSession, message: Message): void {
  session.messages.push(message);
  session.updatedAt = Date.now();
}

/** Truncate messages to the last `n` — used by ContextManager later. */
export function takeLast(session: AgentSession, n: number): Message[] {
  return session.messages.slice(Math.max(0, session.messages.length - n));
}