import { useEffect, type RefObject } from "react";

/**
 * Taped paper notes (`[data-flutter]` inside `root`) lift from their bottom edge in one damped
 * breeze while the tape holds the top (`paper-flutter` in city-stage.css). A mouse starts it when
 * it comes over a note; on a touch screen it runs once, the first time a note comes into view.
 * A breeze in progress is never restarted, so a note always settles before it can lift again.
 */
export function usePaperFlutter(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lift = (note: Element) => note.setAttribute("data-flutter", "on");
    const over = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
      const note = event.target.closest("[data-flutter]");
      if (!note || note.getAttribute("data-flutter") === "on") return;
      if (event.relatedTarget instanceof Node && note.contains(event.relatedTarget)) return;
      lift(note);
    };
    const settle = (event: AnimationEvent) => {
      if (event.animationName === "paper-flutter" && event.target instanceof Element) {
        event.target.setAttribute("data-flutter", "");
      }
    };
    element.addEventListener("pointerover", over);
    element.addEventListener("animationend", settle);
    element.addEventListener("animationcancel", settle);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          lift(entry.target);
        }
      },
      { threshold: 0.35 },
    );
    if (matchMedia("(hover: none)").matches) {
      element.querySelectorAll("[data-flutter]").forEach((note) => observer.observe(note));
    }

    return () => {
      element.removeEventListener("pointerover", over);
      element.removeEventListener("animationend", settle);
      element.removeEventListener("animationcancel", settle);
      observer.disconnect();
    };
  }, [root]);
}
