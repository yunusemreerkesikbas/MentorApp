"use client";
import { Send } from "lucide-react";

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { PuhuImage } from "@/components/puhu-image";

/** Single-line textarea height (min-h-9 + py-2 content). */
const TEXTAREA_MIN_PX = 36;
/**
 * ~10 lines at text-[15px] leading-snug (≈20.625px/line) + py-2 (16px).
 * Grows upward with a 200ms height ease (instant under reduced-motion).
 */
const TEXTAREA_MAX_PX = 222;

/**
 * Chat composer — rounded input card with leading icon and send in the bottom-right.
 * Auto-grows upward one line at a time (smooth height; instant under reduced-motion).
 */
export const CoachComposer = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    busy: boolean;
    disabled?: boolean;
  }
>(function CoachComposer(
  { value, onChange, onSend, busy, disabled = false },
  forwardedRef,
) {
  const translate = useTranslations("coach_chat");
  const reduceMotion = useReducedMotion();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = value.trim().length > 0 && !busy && !disabled;

  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const previous = el.offsetHeight;
    el.style.height = "auto";
    const next = Math.min(
      Math.max(el.scrollHeight, TEXTAREA_MIN_PX),
      TEXTAREA_MAX_PX,
    );

    if (reduceMotion) {
      el.style.transition = "none";
      el.style.height = `${next}px`;
      return;
    }

    // Re-apply previous height so the CSS transition can interpolate to `next`.
    el.style.transition = "none";
    el.style.height = `${previous}px`;
    void el.offsetHeight;
    el.style.transition = "height 200ms cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.height = `${next}px`;
  }, [value, reduceMotion]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <div className="relative z-10 shrink-0 bg-transparent px-5 pt-1 pb-2">
      <div
        className="mx-auto max-w-2xl rounded-[18px] bg-[var(--color-surface)] px-2.5 py-2 shadow-[var(--shadow-card)]"
        style={{
          border: "1px solid color-mix(in srgb, var(--color-main) 6%, transparent)",
        }}
      >
        <div className="flex items-start gap-2">
          <span
            className="mt-1.5 grid size-7 shrink-0 place-items-center overflow-hidden rounded-full"
            aria-hidden
          >
            <PuhuImage variant="default" size={28} className="size-7" />
          </span>
          <label htmlFor="coach-input" className="sr-only">
            {translate("input_label")}
          </label>
          <textarea
            id="coach-input"
            ref={setRefs}
            rows={1}
            value={value}
            disabled={busy || disabled}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={translate("input_placeholder")}
            className="min-h-9 flex-1 resize-none overflow-y-auto bg-transparent py-2 pr-1 text-[15px] leading-snug outline-none placeholder:text-[color-mix(in_srgb,var(--color-secondary)_85%,transparent)] focus-visible:outline-none disabled:opacity-60"
            style={{
              color: "var(--color-body)",
              fontFamily: "var(--font-body)",
              height: TEXTAREA_MIN_PX,
              maxHeight: TEXTAREA_MAX_PX,
            }}
          />
        </div>
        <div className="mt-0.5 flex justify-end">
          <button
            type="button"
            onClick={() => canSend && onSend()}
            disabled={!canSend}
            aria-label={translate("send")}
            className="grid size-9 shrink-0 place-items-center rounded-full text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "var(--color-progress)" }}
          >
            <Send size={16} strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </div>
      <p
        className="mx-auto mt-1.5 max-w-2xl truncate px-1 text-center text-[10px] leading-none whitespace-nowrap"
        style={{ color: "var(--color-secondary)" }}
        title={translate("disclaimer")}
      >
        {translate("disclaimer")}
      </p>
    </div>
  );
});
