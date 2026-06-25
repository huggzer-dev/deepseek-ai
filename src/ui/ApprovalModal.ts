import { App, Modal, Setting, Notice } from "obsidian";
import { translate, type TranslationKey } from "../i18n";
import type { Language, RiskLevel } from "../types";

const RISK_LABELS: Record<RiskLevel, string> = {
  0: "READ_ONLY",
  1: "EDIT_SAFE",
  2: "EDIT_DANGER",
  3: "EXTERNAL",
};

/**
 * Confirmation modal for risky tool calls (EDIT_DANGER / EXTERNAL).
 * Promise resolves with the user's decision (default deny).
 */
export class ApprovalModal extends Modal {
  private resolve: ((allowed: boolean) => void) | undefined;

  constructor(app: App, private details: { tool: string; args: Record<string, unknown>; riskLevel: RiskLevel }, private lang: Language) {
    super(app);
  }

  onOpen(): void {
    const t = (k: TranslationKey) => translate(this.lang, k);
    this.titleEl.setText(t("approval.title"));
    const body = this.contentEl.createDiv({ cls: "deepseek-approval__body" });
    body.createDiv({ cls: "deepseek-approval__row" }, (row) => {
      row.createEl("span", { cls: "deepseek-approval__label", text: "Tool" });
      row.createEl("code", { text: this.details.tool });
      row.createEl("span", { cls: `deepseek-approval__risk is-${RISK_LABELS[this.details.riskLevel].toLowerCase()}`, text: RISK_LABELS[this.details.riskLevel] });
    });
    body.createDiv({ cls: "deepseek-approval__args" }, (argsEl) => {
      argsEl.createEl("div", { cls: "deepseek-approval__label", text: "Arguments" });
      argsEl.createEl("pre", { cls: "deepseek-approval__code" }).setText(JSON.stringify(this.details.args, null, 2));
    });

    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t("approval.deny")).setWarning().onClick(() => this.deny()))
      .addButton((b) => b.setButtonText(t("approval.allow")).setCta().onClick(() => this.allow()));
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
}