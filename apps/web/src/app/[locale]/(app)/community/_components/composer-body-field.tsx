"use client";

import { useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";

import { EmojiPickerButton } from "./EmojiPickerButton";

export function ComposerBodyField({
  id,
  label,
  value,
  onValueChange,
  placeholder,
  disabled = false,
  rows = 7,
  autoFocus = false,
  hideLabel = false,
  onSubmit,
  toolbarActions,
  footerAction,
  compact = false,
  minimal = false,
  onFocus,
  onBlur,
  textareaRef: externalTextareaRef,
  onCaretChange,
  onKeyDown,
  autocomplete,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  autoFocus?: boolean;
  hideLabel?: boolean;
  onSubmit?: () => void;
  toolbarActions?: ReactNode;
  footerAction?: ReactNode;
  compact?: boolean;
  minimal?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onCaretChange?: (value: string, caret: number) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  autocomplete?: {
    expanded: boolean;
    controls: string;
    activeDescendant?: string;
  };
}) {
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef ?? internalTextareaRef;

  return (
    <div className="grid gap-1.5 text-sm font-bold text-[var(--color-main)]">
      <label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </label>
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          onCaretChange?.(event.target.value, event.target.selectionStart ?? event.target.value.length);
        }}
        onSelect={(event) =>
          onCaretChange?.(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
        }
        onKeyDown={(event) => {
          if (onKeyDown?.(event)) return;
          if (onSubmit && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
        maxLength={4000}
        rows={rows}
        required
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={onFocus}
        onBlur={onBlur}
        role={autocomplete ? "combobox" : undefined}
        aria-autocomplete={autocomplete ? "list" : undefined}
        aria-expanded={autocomplete?.expanded}
        aria-controls={autocomplete?.expanded ? autocomplete.controls : undefined}
        aria-activedescendant={autocomplete?.expanded ? autocomplete.activeDescendant : undefined}
        className={`${compact ? "min-h-11 resize-none" : "min-h-[128px] resize-y"} ${minimal ? "border-0 bg-transparent px-0 py-2" : "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-soft)] p-4"} text-[15px] font-normal leading-[1.55] text-[var(--color-body-text)] [font-family:var(--font-body)] outline-none placeholder:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]`}
      />
      <div className="flex min-h-11 items-center justify-between">
        <div className="flex items-center gap-1">
          <EmojiPickerButton
            textareaRef={textareaRef}
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
          />
          {toolbarActions}
        </div>
        {footerAction ?? (
          <span className="text-xs font-normal tabular-nums text-[var(--color-secondary)]">
            {value.length}/4000
          </span>
        )}
      </div>
    </div>
  );
}
