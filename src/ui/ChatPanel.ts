import type { App, Editor, TFile } from "obsidian";
import type DeepSeekPlugin from "../main";
import { MessageBubble } from "./MessageBubble";
import { ToolCallBubble } from "./ToolCallBubble";
import { InputBar, type ParsedInput } from "./InputBar";
import { ConversationTabs } from "./ConversationTabs";
import { translate } from "../i18n";
import { logger } from "../utils/logger";
import type { Message, ToolContext, ContextInput } from "../types";

/**
 * Owns the chat sidebar: renders message list + input bar + tab bar and
 * orchestrates streaming requests to DeepSeek via AgentLoop.
 * Supports multi-session tabs, Plan Mode, and image attachment.
 */
export class ChatPanel {
  private messagesEl!: HTMLElement;
  private headerEl!: HTMLElement;
  private tabsEl!: HTMLElement;
  private tabs: ConversationTabs | undefined;
  private inputBar: InputBar | undefined;
  private planBtn: HTMLButtonElement | undefined;
  private planBadge: HTMLElement | undefined;
  private bubbles: MessageBubble[] = [];
  private abortController: AbortController | undefined;
  private lastUserPayload: ParsedInput | undefined;

  constructor(private app: App, private root: HTMLElement, private plugin: DeepSeekPlugin) {}

  render(): void {
    this.root.empty();
    const view = this.root.createDiv({ cls: "deepseek-chat-view" });

    this.renderHeaderBar(view);
    this.tabsEl = view.createDiv({ cls: "deepseek-tabs-bar" });
    this.messagesEl = view.createDiv({ cls: "deepseek-chat-view__messages" });
    this.inputBar = new InputBar(this.app, view.createDiv({ cls: "deepseek-chat-view__input" }), this.plugin, (p) => {
      void this.onSend(p);
    });

    this.refreshSession();

    // Language-change callback set by the plugin
    this.plugin._onLangChange = () => {
      try { this.render(); } catch { /* panel not in DOM */ }
    };
  }

  private renderHeaderBar(view: HTMLElement): void {
    this.headerEl = view.createDiv({ cls: "deepseek-chat-view__header" });
    this.headerEl.createEl("span", { cls: "deepseek-chat-view__title", text: "DeepSeek" });

    this.planBadge = this.headerEl.createEl("span", { cls: "deepseek-chat-view__plan-badge is-hidden", text: "PLAN" });

    this.planBtn = this.headerEl.createEl("button", {
      cls: "deepseek-chat-view__btn",
      text: translate(this.plugin.settings.language, "plan.enable"),
    });
    this.planBtn.addEventListener("click", () => this.togglePlan());

    const resetBtn = this.headerEl.createEl("button", {
      cls: "deepseek-chat-view__btn",
      text: translate(this.plugin.settings.language, "chat.reset"),
    });
    resetBtn.addEventListener("click", () => this.onReset());
  }

  private refreshSession(): void {
    this.bubbles.forEach((b) => b.destroy());
    this.bubbles = [];
    this.messagesEl.empty();

    // Refresh tabs
    const all = this.plugin.sessions.list();
    const active = this.plugin.sessions.activeSession();
    if (!this.tabs) {
      this.tabs = new ConversationTabs(this.tabsEl, all, active?.id, (action, id) => {
        if (action === "select") {
          const s = this.plugin.sessions.get(id);
          if (s) this.switchTo(s);
        } else if (action === "close") {
          this.abortController?.abort();
          const s = this.plugin.sessions.get(id);
          if (s) { this.plugin.sessions.delete(id); void this.plugin.store.delete(id); }
          if (this.plugin.sessions.activeSession() === undefined) this.plugin.sessions.create();
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
      this.messagesEl.createDiv({ cls: "deepseek-message--assistant deepseek-message" }).setText(
        translate(this.plugin.settings.language, "chat.empty"),
      );
      return;
    }

    // Sync plan badge
    if (active.planMode) {
      this.planBtn!.textContent = translate(this.plugin.settings.language, "plan.disable");
      this.planBadge!.classList.remove("is-hidden");
    } else {
      this.planBtn!.textContent = translate(this.plugin.settings.language, "plan.enable");
      this.planBadge!.classList.add("is-hidden");
    }

    for (const m of active.messages) this.appendMessage(m);
    this.scrollToBottom();
  }

  private switchTo(session: import("../types").AgentSession): void {
    // Save current session first
    void this.persistSession();
    this.plugin.sessions.restore(session);
    this.refreshSession();
  }

  private togglePlan(): void {
    const session = this.plugin.sessions.activeSession();
    if (!session) return;
    session.planMode = !session.planMode;
    this.refreshSession();
  }

  // --- send / stream -----------------------------------------------------

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

    const userMessage: Message = { role: "user", content: userContent };
    this.appendMessage(userMessage);

    const contextInput: ContextInput = {
      userInput: userContent,
      mentions: [],
      images: parsed.images,
      instruction: parsed.instruction,
      skill: parsed.skillBody ? "(pre-injected)" : undefined,
    };

    // Apply plan-mode system prompt override
    if (session.planMode) {
      contextInput.instruction = (
        instrBlock ? instrBlock + "\n" : ""
      ) + "\n## Plan Mode\nBefore answering, output a clear numbered plan with `## Plan` heading, then wait for approval before executing.";
    }

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
    let lastToolCallId: string | undefined;

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
            lastToolCallId = ev.id;
            break;
          }
          case "tool_result": {
            const bubble = toolBubbles.get(ev.id);
            if (bubble) {
              bubble.setResult({ ok: ev.ok, summary: ev.summary, truncated: ev.summary.includes("[truncated]") });
            }
            break;
          }
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
      void lastToolCallId;
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

  private onReset(): void {
    this.abortController?.abort();
    const old = this.plugin.sessions.activeSession();
    const oldId = old?.id;
    if (oldId) this.plugin.sessions.delete(oldId);
    this.plugin.sessions.create();
    this.refreshSession();
    if (oldId) void this.plugin.store.delete(oldId).catch(() => {});
  }

  // --- helpers ------------------------------------------------------------

  private appendMessage(m: Message): void {
    const content = contentToString(m.content);
    const bubble = new MessageBubble(this.app, this.messagesEl!, m.role);
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
    this.plugin._onLangChange = undefined;
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