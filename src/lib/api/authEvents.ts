type Listener = () => void;

// Tiny event hook so the HTTP client can tell the auth layer about a 401
// without importing React or the auth feature.
const listeners = new Set<Listener>();

export const authEvents = {
  onUnauthorized(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  emitUnauthorized(): void {
    for (const listener of listeners) listener();
  },
};
