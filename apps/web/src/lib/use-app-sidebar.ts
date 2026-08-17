"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  applyAppSidebar,
  getAppSidebarServerSnapshot,
  getAppSidebarSnapshot,
  subscribeAppSidebar,
  writeAppSidebar,
} from "./app-sidebar";

export function useAppSidebar() {
  const open = useSyncExternalStore(
    subscribeAppSidebar,
    getAppSidebarSnapshot,
    getAppSidebarServerSnapshot,
  );

  const setOpen = useCallback((next: boolean) => {
    writeAppSidebar(next);
    applyAppSidebar(next);
  }, []);

  return { open, setOpen };
}
