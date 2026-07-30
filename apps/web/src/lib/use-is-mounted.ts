"use client";

import { useSyncExternalStore } from "react";

/** Mount state never changes after hydration — nothing to subscribe to. */
const subscribe = () => () => undefined;

/**
 * `false` on the server and during hydration, `true` afterwards — the SSR-safe gate for
 * `createPortal` and other client-only renders. Replaces the `useState(false)` +
 * `useEffect(() => setMounted(true))` pair, which trips `react-hooks/set-state-in-effect`.
 * Same idiom as `AuthShell`'s welcome-seen read.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
