// Tiny event emitter for state-change notifications. UI widgets that need
// event-driven updates subscribe; Pixi views just read state every frame.

export type ChangeListener = () => void;

export class Observer {
  private listeners: Set<ChangeListener> = new Set();

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(): void {
    for (const listener of this.listeners) listener();
  }
}
