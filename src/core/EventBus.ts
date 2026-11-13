type Listener<P> = (payload: P) => void;

/** Typed publish/subscribe. A throwing listener is logged and never blocks the others. */
export class EventBus<E> {
  private readonly listeners = new Map<keyof E, Listener<never>[]>();

  on<K extends keyof E>(event: K, listener: Listener<E[K]>): () => void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener as Listener<never>);
    this.listeners.set(event, list);
    return () => {
      const current = this.listeners.get(event);
      if (!current) return;
      const index = current.indexOf(listener as Listener<never>);
      if (index >= 0) current.splice(index, 1);
    };
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    // Iterate a copy so a listener may unsubscribe itself while we emit.
    for (const listener of [...list] as Listener<E[K]>[]) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`EventBus listener for "${String(event)}" threw:`, error);
      }
    }
  }
}
