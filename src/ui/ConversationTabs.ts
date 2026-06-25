import type { AgentSession } from "../types";

export type TabAction = "select" | "close" | "new";

/**
 * Horizontal tab bar for multi-conversation management.
 * Renders a row of pill-style tabs plus a "+" spawner.
 */
export class ConversationTabs {
  readonly el: HTMLElement;

  constructor(
    parent: HTMLElement,
    private sessions: AgentSession[],
    private activeId: string | undefined,
    private onAction: (action: TabAction, sessionId: string) => void,
  ) {
    this.el = parent.createDiv({ cls: "deepseek-tabs" });
    this.render();
  }

  update(sessions: AgentSession[], activeId: string | undefined): void {
    this.sessions = sessions;
    this.activeId = activeId;
    this.render();
  }

  private render(): void {
    this.el.empty();
    for (const s of this.sessions) {
      const tab = this.el.createDiv({
        cls: `deepseek-tabs__tab${s.id === this.activeId ? " is-active" : ""}`,
      });
      tab.createSpan({ cls: "deepseek-tabs__label", text: s.title || "Untitled" });
      const close = tab.createSpan({ cls: "deepseek-tabs__close", text: "×" });
      close.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onAction("close", s.id);
      });
      tab.addEventListener("click", () => this.onAction("select", s.id));
    }
    const plus = this.el.createDiv({ cls: "deepseek-tabs__plus", text: "+" });
    plus.addEventListener("click", () => this.onAction("new", ""));
  }
}