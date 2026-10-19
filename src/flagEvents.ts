/** Lets the flag editor, presets and profiles refresh each other after a change. */
const EVENT = "dusk:flags-changed";

export const notifyFlagsChanged = () => window.dispatchEvent(new Event(EVENT));

/** Calls `fn` whenever the flags change elsewhere; returns the unsubscribe function. */
export function onFlagsChanged(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
