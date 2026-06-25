import { App, MarkdownRenderer, Component } from "obsidian";
import type { MessageRole } from "../types";
import { debounce } from "../utils/debounce";

/**
 * A single chat message in the Claudian-style layout:
 *   user       → right-aligned, light gray bubble
 *   assistant  → left-aligned, no bubble (plain text)
 *   system/tool → centered, no bubble, muted
 *
 * Supports streamed assistant replies:
 *   start → appendDelta(...) → finish()
 * Re-renders markdown on every debounced chunk so blocks solidify.
 */
export class MessageBubble {
  readonly el: HTMLElement;
  private contentEl: HTMLElement;
  private typingEl: HTMLElement | undefined;
  private mdComponent: Component | undefined;
  private _buffer = "";
  /** Exposed read-only so ChatPanel can persist partials on abort. */
  get buffer(): string { return this._buffer; }
  private finished = false;

  private readonly debouncedRender: () => void;

  constructor(private app: App, parent: HTMLElement, public role: MessageRole) {
    this.el = parent.createDiv({ cls: `dsai-msg dsai-msg--${this.cssRole(role)}` });
    this.contentEl = this.el.createDiv({ cls: "dsai-bubble" });
    this.el.dataset.role = role;
    this.debouncedRender = debounce(() => this.renderMarkdown(), 70);
  }

  private cssRole(role: MessageRole): string {
    // tool messages are presented as muted system rows
    if (role === "tool") return "system";
    return role;
  }

  setContent(markdown: string): void {
    this._buffer = markdown;
    this.renderMarkdown();
  }

  startStreaming(): void {
    this._buffer = "";
    this.finished = false;
    this.contentEl.empty();
    this.typingEl = this.contentEl.createDiv({ cls: "dsai-typing" });
    for (let i = 0; i < 3; i++) this.typingEl.createEl("span");
  }

  appendDelta(delta: string): void {
    if (this.finished) return;
    if (this.typingEl) {
      this.typingEl.remove();
      this.typingEl = undefined;
    }
    this._buffer += delta;
    this.debouncedRender();
  }

  finish(stopped = false): void {
    this.finished = true;
    this.typingEl?.remove();
    this.typingEl = undefined;
    this.renderMarkdown();
    if (stopped && this._buffer.trim() === "") {
      this.contentEl.createEl("em", { text: "(stopped)" });
    }
  }

  markError(message: string): void {
    this.finished = true;
    this.typingEl?.remove();
    this.typingEl = undefined;
    this.el.addClass("is-error");
    this.contentEl.empty();
    this.contentEl.addClass("dsai-bubble--error");
    this.contentEl.createEl("span", { text: "⚠ " + message });
  }

  addButton(label: string, onClick: () => void): HTMLElement {
    const btn = this.contentEl.createEl("button", { text: label, cls: "dsai-retry-btn" });
    btn.addEventListener("click", onClick);
    return btn;
  }

  destroy(): void {
    if (this.mdComponent) {
      try {
        this.mdComponent.unload();
      } catch {
        /* ignore */
      }
    }
    this.el.remove();
  }

  private renderMarkdown(): void {
    if (this.mdComponent) {
      try {
        this.mdComponent.unload();
      } catch {
        /* ignore */
      }
    }
    this.mdComponent = new Component();
    this.contentEl.empty();
    void MarkdownRenderer.render(this.app, this._buffer, this.contentEl, "", this.mdComponent);
    this.mdComponent.load();
    this.scrollParent();
  }

  private scrollParent(): void {
    const parent = this.el.parentElement;
    if (parent) parent.scrollTop = parent.scrollHeight;
  }
}
