"use client";

import { useSyncExternalStore } from "react";
import type { EconomyBalance } from "@mentor/types";
import { fetchEconomyBalance, isEconomyDisabled } from "./economy";

interface EconomySnapshot {
  balance: EconomyBalance | null;
  revision: number;
  error: boolean;
}
const empty: EconomySnapshot = { balance: null, revision: 0, error: false };
let snapshot = empty;
let generation = 0;
let pending: Promise<void> | null = null;
let dirty = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const publish = (next: EconomySnapshot) => { snapshot = next; listeners.forEach((listener) => listener()); };

/** A single browser-local snapshot also reaches sheets mounted above the app layout. */
export function useEconomySnapshot(): EconomySnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => empty);
}

export function resetEconomySnapshot(): void {
  generation += 1;
  pending = null;
  dirty = false;
  publish(empty);
}

export function refreshEconomySnapshot(): Promise<void> {
  dirty = true;
  if (pending) return pending;
  const version = generation;
  const run = async () => {
    while (dirty && version === generation) {
      dirty = false;
      try {
        const balance = await fetchEconomyBalance();
        if (version === generation) publish({ balance, revision: snapshot.revision + 1, error: false });
      } catch (error) {
        if (version === generation) publish({ balance: null, revision: snapshot.revision + 1, error: !isEconomyDisabled(error) });
      }
    }
  };
  pending = run().finally(() => { if (version === generation) pending = null; });
  return pending;
}
