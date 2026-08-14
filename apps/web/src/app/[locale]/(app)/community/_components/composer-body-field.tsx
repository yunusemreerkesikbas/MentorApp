"use client";

import { useRef } from "react";

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
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="grid gap-1.5 text-sm font-bold text-[#2c3039]">
      <label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </label>
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
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
        className="min-h-[128px] resize-y rounded-[10px] border border-[#e1e4e8] bg-[#fbfcfd] p-4 text-[15px] font-normal leading-[1.55] text-[#343945] [font-family:var(--font-body)] outline-none placeholder:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      />
      <div className="flex min-h-11 items-center justify-between">
        <EmojiPickerButton
          textareaRef={textareaRef}
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
        />
        <span className="text-xs font-normal tabular-nums text-[#666]">
          {value.length}/4000
        </span>
      </div>
    </div>
  );
}
