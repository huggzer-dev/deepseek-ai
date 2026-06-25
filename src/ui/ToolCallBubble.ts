import { setIcon } from "obsidian";
import type { RiskLevel } from "../types";

const RISK_LABELS: Record<RiskLevel, string> = { 0: "READ_ONLY", 1: "EDIT_SAFE", 2: "EDIT_DANGER", 3: "EXTERNAL" };

const MAX_PREVIEW = 1200;

/** Compact tool-call card matching the Claudian light-theme aesthetic. */
export class ToolCallBubble {
  readonly el: HTMLElement;

  constructor(parent: HTMLElement, name: string, args: Record<string, unknown>, riskLevel: RiskLevel = 0) {
    this.el = parent.createDiv({ cls: "dsai-tool-card" });
    this.el.createDiv({ cls: "dsai-tool-card__head" }, (h) => {
      const ico = h.createSpan({ cls: "dsai-ico" });
      setIcon(ico, "wrench");
      h.createSpan({ text: name });
      h.createSpan({
        cls: `dsai-tool-card__risk is-${RISK_LABELS[riskLevel].toLowerCase()}`,
        text: RISK_LABELS[riskLevel],
      });
    });
    this.el.createDiv({ cls: "dsai-tool-card__head" }, (b) => {
      b.createSpan({ cls: "dsai-tool-card__risk is-read_only", text: "args" });
    });
    this.el.createEl("pre", { cls: "dsai-tool-card__code" }).setText(JSON.stringify(args, null, 2));
  }

  setResult(result: { ok: boolean; summary: string; truncated?: boolean }): void {
    let resultEl = this.el.querySelector<HTMLElement>(".dsai-tool-card__result");
    if (!resultEl) {
      resultEl = this.el.createDiv({ cls: "dsai-tool-card__result" });
    }
    resultEl.empty();
    const preview = result.summary.length > MAX_PREVIEW ? result.summary.slice(0, MAX_PREVIEW) + "…" : result.summary;
    resultEl.setText((result.ok ? "result: " : "error: ") + preview + (result.truncated ? " [truncated]" : ""));
  }
}
