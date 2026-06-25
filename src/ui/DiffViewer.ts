/**
 * Minimal line-level diff using LCS — no external deps.
 * Adds show green, removes show red, common lines render verbatim.
 */
export interface DiffLine {
  type: "add" | "del" | "ctx";
  text: string;
  oldNo?: number;
  newNo?: number;
}

export function computeDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  // LCS table
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  let oldNo = 1, newNo = 1;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "ctx", text: a[i], oldNo, newNo });
      i++; j++; oldNo++; newNo++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: a[i], oldNo });
      i++; oldNo++;
    } else {
      out.push({ type: "add", text: b[j], newNo });
      j++; newNo++;
    }
  }
  while (i < m) { out.push({ type: "del", text: a[i], oldNo }); i++; oldNo++; }
  while (j < n) { out.push({ type: "add", text: b[j], newNo }); j++; newNo++; }
  return out;
}

export function applyDiffToElement(parent: HTMLElement, diff: DiffLine[]): void {
  parent.empty();
  const lineEls = diff.map((d) => {
    const row = parent.createDiv({ cls: `deepseek-diff__line is-${d.type}` });
    row.createDiv({ cls: "deepseek-diff__gutter", text: gutterLabel(d) });
    const body = row.createDiv({ cls: "deepseek-diff__body" });
    body.setText(d.text || "\u00a0");
    return row;
  });
  // Auto-scroll to first change block.
  const firstChange = lineEls.find((e) => !e.classList.contains("is-ctx"));
  if (firstChange) firstChange.scrollIntoView({ block: "center" });
}

function gutterLabel(d: DiffLine): string {
  if (d.type === "add") return `+ ${d.newNo ?? ""}`;
  if (d.type === "del") return `- ${d.oldNo ?? ""}`;
  return `  ${d.oldNo ?? ""}`;
}