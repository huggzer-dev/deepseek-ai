/**
 * Lightweight typed event emitter (replacement for Zustand/pub-sub libs).
 * Used across the UI and engine layers to stay decoupled.
 */
export type Listener<T> = (payload: T) => void;

export class EventEmitter<TEvents extends Record<string, unknown>> {
  private listeners: { [K in keyof TEvents]?: Set<Listener<TEvents[K]>> } = {};

  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): () => void {
    const set = (this.listeners[event] ??= new Set());
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): void {
    this.listeners[event]?.delete(listener);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    this.listeners[event]?.forEach((l) => {
      try {
        l(payload);
      } catch (err) {
        console.error("[EventEmitter] listener error", err);
      }
    });
  }

  clear(): void {
    this.listeners = {};
  }
}