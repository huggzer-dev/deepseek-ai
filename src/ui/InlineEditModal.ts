import { App, Editor, Modal, Notice, Setting, TFile } from "obsidian";
import type DeepSeekPlugin from "../main";
import { translate, type TranslationKey } from "../i18n";
import { computeDiff, applyDiffToElement } from "./DiffViewer";
import { logger } from "../utils/logger";

/**
 * Selection → shortcut → prompt → diff preview → accept/cancel.
 * Talks directly to DeepSeekProvider (no tools) to rewrite the selection.
 */
export class InlineEditModal extends Modal {
  private abortController: AbortController | undefined;
  private promptInput: HTMLTextAreaElement | undefined;
  private diffHost: HTMLElement | undefined;
  private oldText = "";
  private newText = "";
  private busy = false;

  constructor(
    app: App,
    private plugin: DeepSeekPlugin,
    private editor: Editor,
    private file: TFile | null,
  ) {
    super(app);
  }

  private t(k: TranslationKey): string {
    return translate(this.plugin.settings.language, k);
  }

  onOpen(): void {
    const t = (k: TranslationKey) => this.t(k);
    const selection = this.editor.getSelection();
    if (!selection) {
      this.contentEl.createEl("p", { text: t("inline.emptySelection") });
      this.contentEl.createEl("button", { text: t("inline.cancel") }).addEventListener("click", () => this.close());
      return;
    }
    this.oldText = selection;

    this.titleEl.setText(t("inline.title"));

    const promptWrap = this.contentEl.createDiv();
    this.promptInput = promptWrap.createEl("textarea", {
      attr: { rows: "3", placeholder: t("inline.promptPlaceholder") },
      cls: "deepseek-inline-prompt",
    });

    const btnRow = this.contentEl.createDiv({ cls: "deepseek-inline__actions" });
    new Setting(btnRow)
      .addButton((b) => b.setButtonText(t("inline.apply")).setCta().onClick(() => void this.generate()))
      .addButton((b) => b.setButtonText(t("inline.regenerate")).onClick(() => void this.generate()))
      .addButton((b) => b.setButtonText(t("inline.cancel")).onClick(() => this.close()));

    this.diffHost = this.contentEl.createDiv({ cls: "deepseek-inline__diff" });
  }

  onClose(): void {
    this.abortController?.abort();
    this.contentEl.empty();
  }

  private async generate(): Promise<void> {
    if (this.busy) return;
    if (!this.plugin.settings.apiKey) {
      new Notice(translate(this.plugin.settings.language, "errors.apiKeyMissing"));
      return;
    }
    if (!this.promptInput || !this.diffHost) return;
    const diffHost = this.diffHost;
    const instruction = this.promptInput.value.trim();
    if (!instruction) return;

    this.busy = true;
    this.diffHost.empty();
    this.diffHost.createEl("div", { cls: "deepseek-typing", text: this.t("inline.loading") });
    this.abortController = new AbortController();

    const ctxLine = this.file ? ` 当前文件: ${this.file.path}\n` : "";
    const system = `You rewrite the user's selection according to their instruction.
Return ONLY the rewritten text (no markdown fences, no explanations).
${ctxLine}`;
    const messages = [
      { role: "system" as const, content: system },
      { role: "user" as const, content: `Instruction: ${instruction}\n\nSelection:\n${this.oldText}` },
    ];

    try {
      const result = await this.plugin.provider.chat(messages, {
        model: this.plugin.settings.model,
        maxTokens: this.plugin.settings.maxTokens,
        temperature: this.plugin.settings.temperature,
        signal: this.abortController.signal,
      }, {});
      const rawContent = Array.isArray(result.message.content) ? result.message.content.map(
        (p) => (p.type === "text" ? p.text : "[image]"),
      ).join("\n") : (result.message.content ?? "");
      this.newText = rawContent.replace(/^```[\w]*\n?|\n?```$/g, "").trim();
      const diff = computeDiff(this.oldText, this.newText);
      applyDiffToElement(diffHost, diff);

      const acceptRow = this.contentEl.createDiv({ cls: "deepseek-inline__post" });
      new Setting(acceptRow)
        .addButton((b) => b.setButtonText(translate(this.plugin.settings.language, "inline.apply")).setCta().onClick(() => {
          this.editor.replaceSelection(this.newText);
          new Notice("Applied ✅");
          this.close();
        }))
        .addButton((b) => b.setButtonText(this.t("inline.regenerate")).onClick(() => void this.generate()));
    } catch (err: unknown) {
      logger.error("inline edit failed", err);
      this.diffHost.empty();
      const msg = err instanceof Error ? err.message : String(err);
      this.diffHost.createEl("p", { cls: "deepseek-message__error", text: msg });
    } finally {
      this.busy = false;
    }
  }
}
