import type { AgentSession } from "../types";

export type TabAction = "select" | "close" | "new";

export function shouldCloseSessionFromPointer(event: Pick<MouseEvent, "buttons">): boolean {
  return event.buttons === 3;
}

/**
 * Numbered tab bar — matches the Claudian / Obsidian reference:
 * each session is a small bordered box showing its index (1, 2, 3 …).
 * Closing is triggered by pressing left and right mouse buttons together on
 * the tab. Action buttons (edit, history) live in the parent tab bar.
 */
export class ConversationTabs {
  readonly el: HTMLElement;

  constructor(
    parent: HTMLElement,
    private sessions: AgentSession[],
    private activeId: string | undefined,
    private onAction: (action: TabAction, sessionId: string) => void,
  ) {
    this.el = parent.createDiv({ cls: "dsai-conv-tabs" });
    this.render();
  }

  update(sessions: AgentSession[], activeId: string | undefined): void {
    this.sessions = sessions;
    this.activeId = activeId;
    this.render();
  }

  private render(): void {
    this.el.empty();
    for (const [i, s] of this.sessions.entries()) {
      const tab = this.el.createDiv({
        cls: `dsai-conv-tab${s.id === this.activeId ? " is-active" : ""}`,
        attr: { title: `${s.title || `Session ${i + 1}`} · 左右键同时点击关闭` },
      });
      tab.createSpan({ cls: "dsai-conv-tab__num", text: String(i + 1) });
      tab.addEventListener("mousedown", (e) => {
        if (shouldCloseSessionFromPointer(e)) {
          e.preventDefault();
          this.onAction("close", s.id);
        }
      });
      tab.addEventListener("contextmenu", (e) => e.preventDefault());
      tab.addEventListener("click", () => {
        this.onAction("select", s.id);
      });
    }
  }
}
