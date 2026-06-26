import type { AgentSession } from "../types";

export type TabAction = "select" | "close" | "new";

/**
 * Numbered tab bar — matches the Claudian / Obsidian reference:
 * each session is a small bordered box showing its index (1, 2, 3 …).
 * A "+" button at the end creates a new session. Action buttons
 * (edit, history) live in the parent tab bar, right-aligned.
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
    for (let i = 0; i < this.sessions.length; i++) {
      const s = this.sessions[i]!;
      const tab = this.el.createDiv({
        cls: `dsai-conv-tab${s.id === this.activeId ? " is-active" : ""}`,
        attr: { title: s.title || `Session ${i + 1}` },
      });
      tab.createSpan({ cls: "dsai-conv-tab__num", text: String(i + 1) });
      tab.addEventListener("click", (e) => {
        // ignore clicks that originate on the close button
        if ((e.target as HTMLElement).closest(".dsai-conv-tab__close")) return;
        this.onAction("select", s.id);
      });
      // Close button: always visible, INSIDE the tab, large enough to hit
      const close = tab.createEl("button", {
        cls: "dsai-conv-tab__close",
        attr: { type: "button", "aria-label": "close", title: "关闭此对话" },
        text: "×",
      });
      close.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.onAction("close", s.id);
      });
    }
  }
}
