/**
 * Rough token estimator (~4 chars/token for mixed CJK+EN text).
 * Used only for context-window heuristics, never for billing.
 */
export class TokenCounter {
  static estimate(text: string): number {
    if (!text) return 0;
    // CJK chars count ~1 token each, latin ~0.25 token per char
    const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
    const rest = text.length - cjk;
    return Math.ceil(cjk + rest / 4);
  }

  static estimateMessages(messages: { content: string | null }[]): number {
    return messages.reduce((sum, m) => sum + TokenCounter.estimate(m.content ?? ""), 0);
  }
}