/** Trailing-edge debounce. Cancels the pending timer when called again. */
export function debounce<T extends (...args: never[]) => void>(fn: T, waitMs: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: never[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  }) as T;
}