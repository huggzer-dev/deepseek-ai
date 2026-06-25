import { App, MarkdownRenderer, Component } from "obsidian";
import type { MessageRole } from "../types";
import { debounce } from "../utils/debounce";

/**
 * A single chat bubble built on native Obsidian DOM + MarkdownRenderer.
 * Supports streamed assistant replies:
 *   start -> appendDelta(...) -> finish()
 * Re-renders markdown on every debounced chunk so blocks solidify instantly.
 */
export class MessageBubble {
  readonly el: HTMLElement;
  private contentEl: HTMLElement;
  private typingEl: HTMLElement | undefined;
  private mdComponent: Component | undefined;
  /** Exposed read-only so ChatPanel can persist partials on abort. */
  private _buffer = "";
  get buffer(): string { return this._buffer; }
  private finished = false;

  private readonly debouncedRender: () => void;

  constructor(private app: App, parent: HTMLElement, public role: MessageRole) {
    this.el = parent.createDiv({ cls: `deepseek-message deepseek-message--${role}` });
    this.contentEl = this.el.createDiv({ cls: "deepseek-message__content" });
    this.el.dataset.role = role;
    this.debouncedRender = debounce(() => this.renderMarkdown(), 70);
  }

  // --- static content ----------------------------------------------------

  setContent(markdown: string): void {
    this._buffer = markdown;
    this.renderMarkdown();
  }

  // --- streaming ---------------------------------------------------------

  startStreaming(): void {
    this._buffer = "";
    this.finished = false;
    this.contentEl.empty();
    this.typingEl = this.el.createDiv({ cls: "deepseek-typing" });
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

  // --- error -------------------------------------------------------------

  markError(message: string): void {
    this.finished = true;
    this.typingEl?.remove();
    this.typingEl = undefined;
    this.el.addClass("is-error");
    this.contentEl.empty();
    this.contentEl.createEl("span", { text: "⚠ " + message, cls: "deepseek-message__error" });
  }

  /** Attach an action button (caller wires the click handler). */
  addButton(label: string, onClick: () => void): HTMLElement {
    const btn = this.el.createEl("button", { text: label, cls: "deepseek-message__action" });
    btn.addEventListener("click", onClick);
    return btn;
  }

  // --- lifecycle ---------------------------------------------------------

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

  // --- internals ---------------------------------------------------------

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