/** Trailing-edge debounce. Cancels the pending timer when called again. */
export function debounce<T extends (...args: never[]) => void>(fn: T, waitMs: number): T {
  let timer: number | undefined;
  return ((...args: never[]) => {
    const timers = timerHost();
    if (timer) timers.clearTimeout(timer);
    timer = timers.setTimeout(() => fn(...args), waitMs);
  }) as T;
}

function timerHost(): Pick<Window, "clearTimeout" | "setTimeout"> {
  return typeof window === "undefined" ? globalThis as unknown as Window : window;
}
