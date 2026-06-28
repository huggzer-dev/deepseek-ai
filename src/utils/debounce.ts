/** Trailing-edge debounce. Cancels the pending timer when called again. */
export function debounce<T extends (...args: never[]) => void>(fn: T, waitMs: number): T {
  let timer: number | undefined;
  return ((...args: never[]) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), waitMs);
  }) as T;
}
