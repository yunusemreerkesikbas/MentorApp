"use client";

import { useRef, type ReactNode } from "react";
import { usePaperFlutter } from "@/app/[locale]/_components/landing/paper-flutter";

/**
 * Wires the landing's paper breeze to every `[data-flutter]` note inside: a mouse over a note, or
 * once as a note comes into view on a touch screen. Reduced motion leaves them all still (the hook
 * checks the preference itself), so the first render never depends on it.
 */
export function SeoFlutterRoot({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  usePaperFlutter(root);
  return (
    <div ref={root} className="seo-flutter">
      {children}
    </div>
  );
}
