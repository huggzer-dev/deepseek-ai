import { type App, type Editor, type TFile, Notice } from "obsidian";
import type DeepSeekPlugin from "../main";
import { MessageBubble } from "./MessageBubble";
import { ToolCallBubble } from "./ToolCallBubble";
import { InputBar, type ParsedInput } from "./InputBar";
import { ConversationTabs } from "./ConversationTabs";
import { translate } from "../i18n";
import { logger } from "../utils/logger";
import type { Message, ToolContext, ContextInput } from "../types";
import { setIcon } from "obsidian";

/**
 * Owns the chat sidebar:
 *
 *   ┌─────────────────────────────────────────┐
 *   │ ◆ deepseek-ai                             │ brand
 *   ├─────────────────────────────────────────┤
 *   │                                          │
 *   │ messages (centered empty state)          │
 *   │                                          │
 *   ├─────────────────────────────────────────┤
 *   │ [1] [2] [3] [+]              [✏] [↻]   │ tabs · actions right
 *   ├─────────────────────────────────────────┤
 *   │ ┌─ chips · selected ──────────────┐    │
 *   │ │ textarea                         │    │
 *   │ └──────────────────────────────────┘    │
 *   │ ⚡ Effort: High  📁                     │ status row
 *   │ 0 条反向链接  ✏  27 个词  166 个字符 👁 │ stats bar
 *   └─────────────────────────────────────────┘
 */
export class ChatPanel {
  private messagesEl!: HTMLElement;
  private tabBarEl!: HTMLElement;
  private inputSectionEl!: HTMLElement;
  private tabsEl!: HTMLElement;
  private statsbarEl!: HTMLElement;
  private tabs: ConversationTabs | undefined;
  private inputBar: InputBar | undefined;
  private effortBtn: HTMLButtonElement | undefined;
  private bubbles: MessageBubble[] = [];
  private abortController: AbortController | undefined;
  private lastUserPayload: ParsedInput | undefined;
  private unsubLang: (() => void) | undefined;

  constructor(private app: App, private root: HTMLElement, private plugin: DeepSeekPlugin) {}

  render(): void {
    this.root.empty();
    const view = this.root.createDiv({ cls: "deepseek-chat-view" });

    this.renderBrand(view);
    this.messagesEl = view.createDiv({ cls: "dsai-messages" });

    this.tabBarEl = view.createDiv({ cls: "dsai-tabbar" });
    this.tabsEl = this.tabBarEl.createDiv({ cls: "dsai-tabbar__tabs" });
    this.renderTabBarActions();

    this.inputSectionEl = view.createDiv({ cls: "dsai-input-section" });
    this.inputSectionEl.createDiv({ cls: "dsai-attachments" });
    this.inputSectionEl.createDiv({ cls: "dsai-selection-counter" });

    this.inputBar = new InputBar(this.app, this.inputSectionEl, this.plugin, (p) => {
      void this.onSend(p);
    }, () => this.refreshStats());

    this.renderStatusRow(this.inputSectionEl);
    this.renderStatsBar(this.inputSectionEl);
    this.statsbarEl = this.inputSectionEl.querySelector(".dsai-statsbar") as HTMLElement;

    this.refreshSession();

    this.unsubLang = () => {
      this.plugin._onLangChange = () => {
        try {
          this.render();
        } catch {
          /* panel not in DOM */
        }
      };
    };
  }

  // --- brand bar ------------------------------------------------------------

  private renderBrand(view: HTMLElement): void {
    const brand = view.createDiv({ cls: "dsai-brand" });
    const icon = brand.createSpan({ cls: "dsai-brand__icon" });
    // Orange diamond ◆ as the brand mark (matches Obsidian screenshot).
    icon.setText("◆");
    brand.createEl("span", { cls: "dsai-brand__name", text: "deepseek-ai" });
  }

  // --- tab bar --------------------------------------------------------------

  private renderTabBarActions(): void {
    const actions = this.tabBarEl.createDiv({ cls: "dsai-tabbar__actions" });
    // Edit button → start a fresh conversation
    const editBtn = actions.createEl("button", { cls: "dsai-tabbar__btn", attr: { "aria-label": "new chat" } });
    setIcon(editBtn, "square-pen");
    editBtn.addEventListener("click", () => this.onNewChat());
    // History button → reload the session list
    const histBtn = actions.createEl("button", { cls: "dsai-tabbar__btn", attr: { "aria-label": "previous" } });
    setIcon(histBtn, "history");
    histBtn.addEventListener("click", () => this.cycleToPreviousSession());
  }

  // --- status row (Effort + folder) and stats bar ------------------------

  private renderStatusRow(parent: HTMLElement): void {
    const t = (k: Parameters<typeof translate>[1]) => translate(this.plugin.settings.language, k);

    const bar = parent.createDiv({ cls: "dsai-statusbar" });

    const effort = bar.createEl("button", { cls: "dsai-statusbar__chip", text: `${t("ui.effort")}: ${this.effortLabel()}` });
    setIcon(effort, "zap");
    this.effortBtn = effort;
    effort.addEventListener("click", () => this.cycleEffort());

    const folder = bar.createEl("button", { cls: "dsai-statusbar__chip", attr: { "aria-label": "attach" } });
    setIcon(folder, "folder");
    folder.addEventListener("click", () => this.inputBar?.focus());
  }

  /** Bottom stats bar — backlinks / word / char counts with eye toggle. */
  private renderStatsBar(parent: HTMLElement): void {
    const t = (k: Parameters<typeof translate>[1]) => translate(this.plugin.settings.language, k);
    const bar = parent.createDiv({ cls: "dsai-statsbar" });
    bar.createSpan({ cls: "dsai-statsbar__backlinks", text: `0 ${t("ui.links")}` });
    const editBtn = bar.createEl("button", { cls: "dsai-statsbar__btn" });
    setIcon(editBtn, "square-pen");
    const stats = this.currentInputStats();
    bar.createSpan({ cls: "dsai-statsbar__words", text: `${stats.words} ${t("ui.words")}` });
    bar.createSpan({ cls: "dsai-statsbar__chars", text: `${stats.chars} ${t("ui.chars")}` });
    const eyeBtn = bar.createEl("button", { cls: "dsai-statsbar__btn" });
    setIcon(eyeBtn, "eye-off");
    void editBtn;
    void eyeBtn;
  }

  private currentInputStats(): { words: number; chars: number } {
    const text = this.inputBar?.value() ?? "";
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { words, chars };
  }

  /** Called by InputBar on every keystroke to refresh word/char counts. */
  private refreshStats(): void {
    if (!this.statsbarEl) return;
    const t = (k: Parameters<typeof translate>[1]) => translate(this.plugin.settings.language, k);
    const stats = this.currentInputStats();
    const w = this.statsbarEl.querySelector(".dsai-statsbar__words");
    const c = this.statsbarEl.querySelector(".dsai-statsbar__chars");
    if (w) w.textContent = `${stats.words} ${t("ui.words")}`;
    if (c) c.textContent = `${stats.chars} ${t("ui.chars")}`;
  }

  // --- messages + sessions -------------------------------------------------

  private refreshSession(): void {
    this.bubbles.forEach((b) => b.destroy());
    this.bubbles = [];
    this.messagesEl.empty();

    const all = this.plugin.sessions.list();
    const active = this.plugin.sessions.activeSession();
    if (!this.tabs) {
      this.tabs = new ConversationTabs(this.tabsEl, all, active?.id, (action, id) => {
        if (action === "select") {
          const s = this.plugin.sessions.get(id);
          if (s) this.switchTo(s);
        } else if (action === "close") {
          this.abortController?.abort();
          this.plugin.sessions.delete(id);
          void this.plugin.store.delete(id);
          if (!this.plugin.sessions.activeSession()) this.plugin.sessions.create();
          this.refreshSession();
        } else if (action === "new") {
          this.abortController?.abort();
          this.plugin.sessions.create();
          this.refreshSession();
        }
      });
    } else {
      this.tabs.update(all, active?.id);
    }

    if (!active || active.messages.length === 0) {
      const empty = this.messagesEl.createDiv({ cls: "dsai-empty" });
      empty.setText(translate(this.plugin.settings.language, "chat.empty"));
      this.messagesEl.addClass("is-empty");
      return;
    }
    this.messagesEl.removeClass("is-empty");
    for (const m of active.messages) this.appendMessage(m);
    this.scrollToBottom();
  }

  private switchTo(session: import("../types").AgentSession): void {
    void this.persistSession();
    this.plugin.sessions.restore(session);
    this.refreshSession();
  }

  /** History button: cycle to the previous (most recently updated) session. */
  private cycleToPreviousSession(): void {
    const all = this.plugin.sessions.list();
    if (all.length <= 1) {
      new Notice("Only one conversation in history");
      return;
    }
    // Sort by updatedAt descending, find current, pick next
    const sorted = [...all].sort((a, b) => b.updatedAt - a.updatedAt);
    const currentId = this.plugin.sessions.activeSession()?.id;
    const currentIdx = sorted.findIndex((s) => s.id === currentId);
    const next = sorted[(currentIdx + 1) % sorted.length];
    if (next) this.switchTo(next);
  }

  /** Start a brand-new conversation (keeps the old one in history). */
  private onNewChat(): void {
    this.abortController?.abort();
    this.plugin.sessions.create();
    this.refreshSession();
  }

  // --- settings actions (effort only — Sonnet / YOLO removed per design) -

  private async cycleEffort(): Promise<void> {
    const order = ["low", "medium", "high"] as const;
    const i = order.indexOf(this.plugin.settings.effort);
    this.plugin.settings.effort = order[(i + 1) % order.length]!;
    await this.plugin.saveSettings();
    if (this.effortBtn) {
      this.effortBtn.textContent = `${translate(this.plugin.settings.language, "ui.effort")}: ${this.effortLabel()}`;
    }
  }

  private effortLabel(): string {
    const map: Record<string, string> = { low: "Low", medium: "Med", high: "High" };
    return map[this.plugin.settings.effort] ?? "High";
  }

  // --- send ---------------------------------------------------------------

  private async onSend(parsed: ParsedInput): Promise<void> {
    this.lastUserPayload = parsed;
    this.inputBar?.setSending(true);

    const ac = new AbortController();
    this.abortController = ac;
    this.inputBar?.setAbortController(ac);

    const apiKey = this.plugin.settings.apiKey;
    if (!apiKey) {
      this.inputBar?.setSending(false);
      this.appendError(translate(this.plugin.settings.language, "errors.apiKeyMissing"));
      return;
    }

    const mentionContents: string[] = [];
    for (const f of parsed.mentions) {
      try {
        const content = await this.app.vault.read(f);
        mentionContents.push(`## @${f.path}\n\n${content}`);
      } catch (err: unknown) {
        logger.warn("failed to read mentioned file", f.path, err);
      }
    }
    const skillBlock = parsed.skillBody ? `## Skill template\n\n${parsed.skillBody}` : "";
    const instrBlock = parsed.instruction ? `## Additional instruction\n\n${parsed.instruction}` : "";
    const userContent = [parsed.text, ...mentionContents, skillBlock, instrBlock].filter(Boolean).join("\n\n");

    const session = this.plugin.sessions.activeSession();
    if (!session) {
      this.appendError(translate(this.plugin.settings.language, "errors.cannotOpenView"));
      return;
    }

    this.appendMessage({ role: "user", content: userContent });

    const contextInput: ContextInput = {
      userInput: userContent,
      mentions: [],
      images: parsed.images,
      instruction: parsed.instruction,
      skill: parsed.skillBody ? "(pre-injected)" : undefined,
    };

    const ctx: ToolContext = {
      app: this.app,
      vault: this.app.vault,
      workspace: this.app.workspace,
      ...this.activeEditorContext(),
      signal: ac.signal,
      aborted: false,
      emitText: undefined,
    };

    const assistantBubble = new MessageBubble(this.app, this.messagesEl!, "assistant");
    this.bubbles.push(assistantBubble);
    assistantBubble.startStreaming();

    ctx.emitText = (delta) => assistantBubble.appendDelta(delta);

    const toolBubbles = new Map<string, ToolCallBubble>();

    try {
      const gen = this.plugin.agent.run(session, contextInput, ctx);
      while (true) {
        const { value, done } = await gen.next();
        if (done) break;
        const ev = value;
        switch (ev.type) {
          case "text_delta":
            assistantBubble.appendDelta(ev.content);
            break;
          case "text_done":
            assistantBubble.finish();
            break;
          case "tool_call": {
            assistantBubble.finish();
            const bubble = new ToolCallBubble(this.messagesEl!, ev.name, ev.args, ev.riskLevel);
            toolBubbles.set(ev.id, bubble);
            break;
          }
          case "tool_result": {
            const bubble = toolBubbles.get(ev.id);
            if (bubble) {
              bubble.setResult({ ok: ev.ok, summary: ev.summary, truncated: ev.summary.includes("[truncated]") });
            }
            break;
          }
          case "plan":
            void ev;
            break;
          case "complete":
            assistantBubble.finish(ac.signal.aborted);
            break;
          case "error":
            if (ac.signal.aborted) {
              assistantBubble.finish(true);
            } else {
              assistantBubble.markError(ev.message);
              assistantBubble.addButton(translate(this.plugin.settings.language, "chat.retry"), () => void this.retry());
            }
            break;
        }
      }
      session.updatedAt = Date.now();
      await this.persistSession();
    } catch (err: unknown) {
      const aborted = ac.signal.aborted;
      ctx.aborted = aborted;
      assistantBubble.finish(aborted);
      if (!aborted) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const msg = translate(this.plugin.settings.language, "errors.networkError") + errMsg;
        assistantBubble.markError(msg);
        assistantBubble.addButton(translate(this.plugin.settings.language, "chat.retry"), () => void this.retry());
      }
      logger.error("agent run failed", err);
    } finally {
      this.inputBar?.setSending(false);
      this.abortController = undefined;
      this.inputBar?.clear();
      this.inputBar?.focus();
    }
  }

  private activeEditorContext(): { editor?: Editor; file?: TFile } {
    const leaf = this.app.workspace.activeEditor;
    if (leaf?.editor && leaf.file) return { editor: leaf.editor, file: leaf.file };
    return {};
  }

  private retry(): void {
    if (!this.lastUserPayload) return;
    const last = this.bubbles.at(-1);
    if (last?.el.classList.contains("is-error")) last.destroy();
    void this.onSend(this.lastUserPayload!);
  }

  // --- helpers -------------------------------------------------------------

  private appendMessage(m: Message): void {
    const content = contentToString(m.content);
    const role = m.role === "tool" ? "system" : m.role;
    const bubble = new MessageBubble(this.app, this.messagesEl!, role);
    this.bubbles.push(bubble);
    bubble.setContent(content);
    this.scrollToBottom();
  }

  private appendError(message: string): void {
    const bubble = new MessageBubble(this.app, this.messagesEl!, "assistant");
    this.bubbles.push(bubble);
    bubble.markError(message);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private async persistSession(): Promise<void> {
    try {
      await this.plugin.store.saveAll(this.plugin.sessions.list());
    } catch (err: unknown) {
      logger.warn("failed to persist session", err);
    }
  }

  destroy(): void {
    this.unsubLang?.();
    this.bubbles.forEach((b) => b.destroy());
    this.bubbles = [];
    this.inputBar?.destroy();
    this.root.empty();
  }
}

/** Convert the union MessageContent to a plain string for rendering. */
function contentToString(content: import("../types").MessageContent): string {
  if (content === null) return "";
  if (Array.isArray(content)) {
    return content.map((p) => (p.type === "image_url" ? "[image]" : p.text)).join("\n");
  }
  return content;
}
