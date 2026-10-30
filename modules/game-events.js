export function createEventBus() {
  const listenersByEvent = new Map();

  function on(eventName, listener) {
    if (!eventName || typeof listener !== "function") return () => {};
    const listeners = listenersByEvent.get(eventName) || new Set();
    listeners.add(listener);
    listenersByEvent.set(eventName, listeners);
    return () => listeners.delete(listener);
  }

  function emit(eventName, payload = {}) {
    const listeners = listenersByEvent.get(eventName);
    if (!listeners?.size) return [];
    const results = [];
    listeners.forEach((listener) => {
      results.push(listener(payload, eventName));
    });
    return results;
  }

  function clear(eventName = null) {
    if (eventName) listenersByEvent.delete(eventName);
    else listenersByEvent.clear();
  }

  return { on, emit, clear };
}
