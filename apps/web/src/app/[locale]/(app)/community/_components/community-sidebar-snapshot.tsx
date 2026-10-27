"use client";
import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import type { ZoneView } from "@mentor/types";

type SidebarSnapshot = Pick<ZoneView, "id" | "title" | "slug" | "type" | "myStatus" | "visibility" | "isArchived">;
type Snapshots = Record<string, SidebarSnapshot[] | null>;
const SnapshotContext = createContext<{ snapshots: Snapshots; report: (id: string, zones: ZoneView[] | null | undefined) => void } | null>(null);
const project = (zones: ZoneView[]) => zones.map(({ id, title, slug, type, myStatus, visibility, isArchived }) => ({ id, title, slug, type, myStatus, visibility, isArchived }));

/** Both persistent sidebars must render the same public rooms as the server's ad proof. */
export function CommunitySidebarSnapshotProvider({ children }: { children: ReactNode }) {
  const [snapshots, setSnapshots] = useState<Snapshots>({});
  const report = useCallback((id: string, zones: ZoneView[] | null | undefined) => setSnapshots((current) => {
    const next = { ...current };
    if (zones === undefined) delete next[id];
    else next[id] = zones === null ? null : project(zones);
    return next;
  }), []);
  const value = useMemo(() => ({ snapshots, report }), [snapshots, report]);
  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
}

export function useReportCommunitySidebar(zones: ZoneView[] | null) {
  const context = useContext(SnapshotContext);
  const report = context?.report;
  const id = useId();
  useLayoutEffect(() => {
    report?.(id, zones);
    return () => report?.(id, undefined);
  }, [id, zones, report]);
}

export function useCommunitySidebarMatches(expected: ZoneView[] | undefined) {
  const context = useContext(SnapshotContext);
  const snapshots = Object.values(context?.snapshots ?? {});
  const key = expected ? JSON.stringify(project(expected)) : null;
  return key !== null && snapshots.length > 0 && snapshots.every((actual) => actual !== null && JSON.stringify(actual) === key);
}
