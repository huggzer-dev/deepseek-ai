import type { App, Editor, TFile } from "obsidian";
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
 * Owns the chat sidebar with a Claudian-style layout:
 *
 *   ┌─────────────────────────────────────────┐
 *   │ ✦ deepseek-ai                             │ ← brand bar
 *   ├─────────────────────────────────────────┤
 *   │                                          │
 *   │ messages (user right, assistant left)    │
 *   │                                          │
 *   ├─────────────────────────────────────────┤
 *   │ [1] [2] [3*]                  [✏] [↻]   │ ← tab bar
 *   ├─────────────────────────────────────────┤
 *   │ ┌─ chips · selected ──────────────┐    │
 *   │ │ textarea                         │    │
 *   │ └──────────────────────────────────┘    │
 *   │ Sonnet  Effort: High  📁      [YOLO]     │ ← status row
 *   └─────────────────────────────────────────┘
 */
export class ChatPanel {
  private messagesEl!: HTMLElement;
  private tabBarEl!: HTMLElement;
  private inputSectionEl!: HTMLElement;
  private tabsEl!: HTMLElement;
  private tabs: ConversationTabs | undefined;
  private inputBar: InputBar | undefined;
  private effortBtn: HTMLButtonElement | undefined;
  private yoloToggle: HTMLButtonElement | undefined;
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
    });

    this.renderStatusRow(this.inputSectionEl);

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
    const editBtn = actions.createEl("button", { cls: "dsai-tabbar__btn", attr: { "aria-label": "edit" } });
    setIcon(editBtn, "square-pen");
    editBtn.addEventListener("click", () => this.onReset());
    const histBtn = actions.createEl("button", { cls: "dsai-tabbar__btn", attr: { "aria-label": "history" } });
    setIcon(histBtn, "history");
    histBtn.addEventListener("click", () => this.onReset());
  }

  // --- status row (model + effort + folder + YOLO) -------------------------

  private renderStatusRow(parent: HTMLElement): void {
    const bar = parent.createDiv({ cls: "dsai-statusbar" });
    const t = (k: Parameters<typeof translate>[1]) => translate(this.plugin.settings.language, k);

    const sonnet = bar.createEl("button", { cls: "dsai-statusbar__chip is-accent", text: t("ui.sonnet") });
    setIcon(sonnet, "zap");
    sonnet.addEventListener("click", () => this.cycleModel());

    this.effortBtn = bar.createEl("button", { cls: "dsai-statusbar__chip", text: `${t("ui.effort")}: ${this.effortLabel()}` });
    this.effortBtn.addEventListener("click", () => this.cycleEffort());

    const folder = bar.createEl("button", { cls: "dsai-statusbar__chip", attr: { "aria-label": "attach" } });
    setIcon(folder, "folder");
    folder.addEventListener("click", () => this.inputBar?.focus());

    const spacer = bar.createDiv({ cls: "dsai-statusbar__spacer" });

    this.yoloToggle = bar.createEl("button", {
      cls: `dsai-toggle${this.plugin.settings.yolo ? " is-on" : ""}`,
      attr: { "aria-label": "yolo" },
    });
    const yoloLabel = this.yoloToggle.createSpan({ text: t("ui.yolo") });
    void yoloLabel;
    this.yoloToggle.createDiv({ cls: "dsai-toggle__switch" });
    this.yoloToggle.addEventListener("click", () => this.toggleYolo());

    bar.appendChild(spacer);
    bar.appendChild(this.yoloToggle);
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

  private onReset(): void {
    this.abortController?.abort();
    const old = this.plugin.sessions.activeSession();
    const oldId = old?.id;
    if (oldId) this.plugin.sessions.delete(oldId);
    this.plugin.sessions.create();
    this.refreshSession();
    if (oldId) void this.plugin.store.delete(oldId).catch(() => {});
  }

  // --- settings actions (model / effort / yolo) ---------------------------

  private async cycleModel(): Promise<void> {
    const models = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;
    const i = models.indexOf(this.plugin.settings.model as (typeof models)[number]);
    this.plugin.settings.model = models[(i + 1) % models.length]!;
    await this.plugin.saveSettings();
    this.render();
  }

  private async cycleEffort(): Promise<void> {
    const order = ["low", "medium", "high"] as const;
    const i = order.indexOf(this.plugin.settings.effort);
    this.plugin.settings.effort = order[(i + 1) % order.length]!;
    await this.plugin.saveSettings();
    if (this.effortBtn) this.effortBtn.textContent = `${translate(this.plugin.settings.language, "ui.effort")}: ${this.effortLabel()}`;
  }

  private async toggleYolo(): Promise<void> {
    this.plugin.settings.yolo = !this.plugin.settings.yolo;
    if (this.plugin.settings.yolo) {
      this.plugin.settings.autoApproveRisk = 99 as import("../types").RiskLevel;
    } else {
      this.plugin.settings.autoApproveRisk = 0; // RiskLevel.READ_ONLY
    }
    await this.plugin.saveSettings();
    this.render();
  }

  private effortLabel(): string {
    const map: Record<string, string> = { low: "Low", medium: "Med", high: "High" };
    return map[this.plugin.settings.effort] ?? "High";
  }

  // --- send / stream -------------------------------------------------------

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
