"use client";

import { forwardRef, type KeyboardEvent } from "react";
import Send from "lucide-react/dist/esm/icons/send.mjs";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS } from "@/lib/app-shell";

/**
 * Sticky chat composer. Enter sends, Shift+Enter inserts a newline; the send button is disabled while
 * empty or busy. The textarea ref is forwarded so the parent can return focus after a send / chip pick.
 * Below it, a §4 #1 caption sets expectations (the coach won't give official dates/process).
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
  ref,
) {
  const translate = useTranslations("coach_chat");
  const canSend = value.trim().length > 0 && !busy && !disabled;

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <div
      className={`sticky z-10 border-t border-white bg-white/80 px-5 py-3 backdrop-blur-sm ${MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS}`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-2xl items-end gap-2">
        <label htmlFor="coach-input" className="sr-only">
          {translate("input_label")}
        </label>
        <textarea
          id="coach-input"
          ref={ref}
          rows={1}
          value={value}
          disabled={busy || disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={translate("input_placeholder")}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[var(--radius-card)] border border-white bg-white/50 px-4 py-2.5 text-base outline-none focus-visible:ring-2 disabled:opacity-60"
          style={{
            color: "var(--color-body)",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
          }}
        />
        <Button
          type="button"
          onClick={() => canSend && onSend()}
          disabled={!canSend}
          aria-label={translate("send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center !px-0 !py-0"
        >
          <Send size={20} strokeWidth={2} aria-hidden />
        </Button>
      </div>
      <p
        className="mx-auto mt-2 max-w-2xl text-xs"
        style={{ color: "var(--color-secondary)" }}
      >
        {translate("disclaimer")}
      </p>
    </div>
  );
});
