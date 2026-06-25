import { App, Modal, Notice } from "obsidian";
import { translate, type TranslationKey } from "../i18n";
import type { Language, RiskLevel } from "../types";

/**
 * Confirmation modal for tool calls. The dialog shows:
 *   - title: "工具调用需要确认"
 *   - tool name + risk level pill
 *   - "Arguments" label
 *   - pretty-printed JSON of the call's arguments
 *   - "拒绝" (red) and "允许" (purple) buttons
 *
 * Default deny on close. Promise resolves with the user's decision.
 */
export class ApprovalModal extends Modal {
  private resolve: ((allowed: boolean) => void) | undefined;

  constructor(
    app: App,
    private details: { tool: string; args: Record<string, unknown>; riskLevel: RiskLevel },
    private lang: Language,
  ) {
    super(app);
  }

  onOpen(): void {
    const t = (k: TranslationKey) => translate(this.lang, k);
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("deepseek-approval");

    // Header row
    const header = contentEl.createDiv({ cls: "deepseek-approval__head" });
    header.createEl("h2", { text: t("approval.title") });
    const closeBtn = header.createEl("button", { cls: "deepseek-approval__close", attr: { "aria-label": "close" } });
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => this.deny());

    // Tool info line
    const toolLine = contentEl.createDiv({ cls: "deepseek-approval__tool" });
    toolLine.createEl("span", { cls: "deepseek-approval__tool-name", text: `Tool${this.details.tool}` });
    const riskLabel = this.riskLabel(this.details.riskLevel);
    toolLine.createEl("span", { cls: `deepseek-approval__risk is-${riskLabel.toLowerCase()}`, text: riskLabel });

    // Arguments label + code block
    contentEl.createEl("div", { cls: "deepseek-approval__label", text: "Arguments" });
    const code = contentEl.createEl("pre", { cls: "deepseek-approval__code" });
    code.textContent = JSON.stringify(this.details.args, null, 2);

    // Action buttons
    const actions = contentEl.createDiv({ cls: "deepseek-approval__actions" });
    const denyBtn = actions.createEl("button", { cls: "deepseek-approval__btn deepseek-approval__btn--deny", text: t("approval.deny") });
    denyBtn.addEventListener("click", () => this.deny());
    const allowBtn = actions.createEl("button", { cls: "deepseek-approval__btn deepseek-approval__btn--allow", text: t("approval.allow") });
    allowBtn.addEventListener("click", () => this.allow());
  }

  onClose(): void {
    this.contentEl.empty();
    if (this.resolve) {
      this.resolve(false);
      new Notice("Tool call discarded");
    }
  }

  pick(): Promise<boolean> {
    return new Promise<boolean>((res) => {
      this.resolve = res;
      this.open();
    });
  }

  private allow(): void {
    if (!this.resolve) return;
    this.resolve(true);
    this.resolve = undefined;
    this.close();
  }

  private deny(): void {
    if (!this.resolve) return;
    this.resolve(false);
    this.resolve = undefined;
    this.close();
  }

  private riskLabel(level: RiskLevel): string {
    switch (level) {
      case 0: return "READ_ONLY";
      case 1: return "EDIT_SAFE";
      case 2: return "EDIT_DANGER";
      case 3: return "EXTERNAL";
      default: return "UNKNOWN";
    }
  }
}
