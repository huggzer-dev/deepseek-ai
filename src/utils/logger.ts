/** Minimal logger that prefixes every entry with the plugin tag. */
export const logger = {
  debug: (...args: unknown[]) => console.debug("[deepseek-ai]", ...args),
  info: (...args: unknown[]) => console.info("[deepseek-ai]", ...args),
  warn: (...args: unknown[]) => console.warn("[deepseek-ai]", ...args),
  error: (...args: unknown[]) => console.error("[deepseek-ai]", ...args),
} as const;