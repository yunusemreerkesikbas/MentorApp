import { ViewTransition, type ReactNode } from "react";

/** Transition type → view-transition class; anything else (browser back, a refresh) stays still. */
const SLIDE = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

/**
 * The coach pages' directional slide (Durak F): a link tagged `nav-forward` (into a student, on to
 * the next one) moves the page left, `nav-back` (to the list) moves it right. It wraps each
 * `page.tsx`, not the layout: a layout persists across the navigation, so it never enters or exits.
 * The CSS and the still chrome are in `coach-theme.css`.
 */
export function CoachPageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={SLIDE} exit={SLIDE} default="none">
      {children}
    </ViewTransition>
  );
}
