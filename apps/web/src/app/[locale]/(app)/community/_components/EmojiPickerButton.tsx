"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Smile } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EmojiClickData } from "emoji-picker-react";

import { insertEmojiAtSelection } from "./insert-emoji";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
const COMPOSER_MAX_LENGTH = 4000;
const PICKER_WIDTH = 350;
const PICKER_HEIGHT = 400;
const VIEWPORT_GUTTER = 12;
const TRIGGER_GAP = 8;

type EmojiPickerStyle = React.CSSProperties & {
  "--epr-emoji-size": string;
};

const COMPACT_PICKER_STYLE: EmojiPickerStyle = {
  "--epr-emoji-size": "24px",
  fontSize: "14px",
};

type EmojiPickerButtonProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  onInserted?: (textarea: HTMLTextAreaElement) => void;
};

export function EmojiPickerButton({
  textareaRef,
  value,
  onValueChange,
  disabled = false,
  onInserted,
}: EmojiPickerButtonProps) {
  const t = useTranslations("community");
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingCaretRef = useRef<number | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    if (window.matchMedia("(max-width: 639px)").matches) {
      setPosition({ position: "fixed", left: VIEWPORT_GUTTER, right: VIEWPORT_GUTTER, bottom: VIEWPORT_GUTTER });
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const insideDialog = Boolean(trigger.closest("dialog"));
    const horizontalOffset = insideDialog ? 0 : window.scrollX;
    const verticalOffset = insideDialog ? 0 : window.scrollY;
    const left = Math.max(
      VIEWPORT_GUTTER,
      Math.min(
        rect.left + horizontalOffset,
        window.innerWidth + horizontalOffset - PICKER_WIDTH - VIEWPORT_GUTTER,
      ),
    );
    setPosition({
      position: insideDialog ? "fixed" : "absolute",
      left,
      top: rect.bottom + verticalOffset + TRIGGER_GAP,
      width: PICKER_WIDTH,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    const textarea = textareaRef.current;
    if (caret === null || !textarea) return;
    pendingCaretRef.current = null;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(caret, caret);
    onInserted?.(textarea);
  }, [onInserted, textareaRef, value]);

  const handleEmojiClick = (data: EmojiClickData) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const result = insertEmojiAtSelection(value, data.emoji, start, end, COMPOSER_MAX_LENGTH);
    if (!result.inserted) return;
    pendingCaretRef.current = result.caret;
    onValueChange(result.value);
  };

  const portalTarget = triggerRef.current?.closest("dialog") ??
    (typeof document === "undefined" ? null : document.body);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={t("emoji_add")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className="grid size-11 place-items-center rounded-full text-[var(--color-secondary)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      >
        <Smile size={20} aria-hidden />
      </button>
      {open && position && portalTarget && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t("emoji_picker")}
          style={position}
          className="z-[60] overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-card)] [&_.epr-emoji-category-label]:!text-[14px] [&_input]:!text-[14px]"
        >
          <EmojiPicker
            width="100%"
            height={PICKER_HEIGHT}
            style={COMPACT_PICKER_STYLE}
            lazyLoadEmojis
            autoFocusSearch={false}
            searchPlaceholder={t("emoji_search")}
            searchClearButtonLabel={t("emoji_search_clear")}
            previewConfig={{ showPreview: false }}
            onEmojiClick={handleEmojiClick}
          />
        </div>,
        portalTarget,
      )}
    </>
  );
}
