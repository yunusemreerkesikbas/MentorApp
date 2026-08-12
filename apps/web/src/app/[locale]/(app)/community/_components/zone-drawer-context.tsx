"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

interface ZoneDrawerContextValue {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const ZoneDrawerContext = createContext<ZoneDrawerContextValue | null>(null);

export function ZoneDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  const value = useMemo(
    () => ({ open, openDrawer, closeDrawer, triggerRef }),
    [closeDrawer, open, openDrawer],
  );

  return <ZoneDrawerContext.Provider value={value}>{children}</ZoneDrawerContext.Provider>;
}

export function useZoneDrawer(): ZoneDrawerContextValue {
  const context = useContext(ZoneDrawerContext);
  if (!context) throw new Error("useZoneDrawer must be used within ZoneDrawerProvider");
  return context;
}
