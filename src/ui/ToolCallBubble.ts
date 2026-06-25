import { setIcon } from "obsidian";
import type { RiskLevel } from "../types";

const RISK_LABELS: Record<RiskLevel, string> = { 0: "READ_ONLY", 1: "EDIT_SAFE", 2: "EDIT_DANGER", 3: "EXTERNAL" };

const MAX_PREVIEW = 1200;

/** Compact card showing a tool call name, args preview and result. */
export class ToolCallBubble {
  readonly el: HTMLElement;

  constructor(parent: HTMLElement, name: string, args: Record<string, unknown>, riskLevel: RiskLevel = 0) {
    this.el = parent.createDiv({ cls: "deepseek-tool-call" });
    this.el.createDiv({ cls: "deepseek-tool-call__header" }, (h) => {
      setIcon(h, "wrench");
      h.createSpan({ cls: "deepseek-tool-call__name", text: name });
      h.createSpan({ cls: `deepseek-tool-call__risk is-${RISK_LABELS[riskLevel].toLowerCase()}`, text: RISK_LABELS[riskLevel] });
    });
    this.el.createDiv({ cls: "deepseek-tool-call__body" }, (b) => {
      b.createEl("span", { cls: "deepseek-tool-call__label", text: "args" });
      b.createEl("pre", { cls: "deepseek-tool-call__code" }).setText(JSON.stringify(args, null, 2));
    });
  }

  /** Attach (or replace) the result preview line. */
  setResult(result: { ok: boolean; summary: string; truncated?: boolean }): void {
    let resultEl = this.el.querySelector<HTMLElement>(".deepseek-tool-call__result");
    if (!resultEl) resultEl = this.el.createDiv({ cls: "deepseek-tool-call__result" });
    resultEl.empty();
    resultEl.createEl("span", { cls: `deepseek-tool-call__label is-${result.ok ? "ok" : "err"}`, text: result.ok ? "result" : "error" });
    const preview = result.summary.length > MAX_PREVIEW ? result.summary.slice(0, MAX_PREVIEW) + "…" : result.summary;
    resultEl.createDiv({ cls: "deepseek-tool-call__preview" }).setText(preview + (result.truncated ? " [truncated]" : ""));
  }
}