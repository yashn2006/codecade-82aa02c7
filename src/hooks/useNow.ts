import { useSyncExternalStore } from "react";

/**
 * One shared 1-second clock for the whole page. Only components that call
 * useNow() re-render each tick — cards stay put, their clocks update.
 */
const listeners = new Set<() => void>();
let current = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => current || Date.now();
const getServerSnapshot = () => 0;

/** Current epoch ms, ticking once per second. Returns 0 during SSR. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
