import { App, TFile } from "obsidian";

/**
 * Lightweight caret-style popup for @-mentions. Positions itself below the
 * owning textarea and lets the user pick a vault note; the selected path is
 * handed back and the caller inserts it as `@[[path]]`.
 */
export class MentionSuggest {
  private popup: HTMLElement | undefined;
  private items: TFile[] = [];

  constructor(private app: App, private textarea: HTMLTextAreaElement, private onSelect: (file: TFile) => void) {}

  /** Show the popup with `query` filtering the vault's markdown files. */
  open(query: string): void {
    this.close();
    const q = query.toLowerCase();
    const all = this.app.vault.getMarkdownFiles();
    this.items = (q
      ? all.filter((f) => f.path.toLowerCase().includes(q) || f.basename.toLowerCase().includes(q))
      : all
    ).slice(0, 12) ?? [];

    const wrap = this.textarea.parentElement;
    if (!wrap) return;
    wrap.style.position = wrap.style.position || "relative";

    const popup = wrap.createDiv({ cls: "deepseek-mention" });
    this.popup = popup;
    if (!this.items.length) {
      popup.createDiv({ cls: "deepseek-mention__item is-empty", text: "no matching files" });
      return;
    }
    this.items.forEach((f, i) => {
      const item = popup.createDiv({ cls: "deepseek-mention__item" });
      item.createEl("span", { cls: "deepseek-mention__name", text: f.basename });
      item.createEl("span", { cls: "deepseek-mention__path", text: f.path });
      item.addEventListener("click", () => this.pick(i));
    });
    popup.style.bottom = `${this.textarea.offsetHeight + 8}px`;
    void query;
  }

  private pick(index: number): void {
    const file = this.items[index];
    if (!file) return;
    this.onSelect(file);
    this.close();
  }

  close(): void {
    this.popup?.remove();
    this.popup = undefined;
    this.items = [];
  }
}