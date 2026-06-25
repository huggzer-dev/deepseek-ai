import type { AgentSession } from "../types";

export type TabAction = "select" | "close" | "new";

/**
 * Horizontal tab bar for multi-conversation management.
 * Renders a row of text-based session tabs plus a "+" spawner at the end.
 * Matches the Obsidian-native look (titles wrap to 2 lines if long).
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
    const list = this.el.createDiv({ cls: "dsai-conv-tabs__list" });
    for (const s of this.sessions) {
      const tab = list.createDiv({
        cls: `dsai-conv-tab${s.id === this.activeId ? " is-active" : ""}`,
        attr: { title: s.title || "Untitled" },
      });
      tab.createSpan({ cls: "dsai-conv-tab__label", text: s.title || "Untitled" });
      tab.addEventListener("click", () => this.onAction("select", s.id));
      const close = tab.createSpan({ cls: "dsai-conv-tab__close", text: "×" });
      close.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onAction("close", s.id);
      });
    }
    const plus = list.createDiv({ cls: "dsai-conv-tab__plus", text: "+" });
    plus.addEventListener("click", () => this.onAction("new", ""));
  }
}
