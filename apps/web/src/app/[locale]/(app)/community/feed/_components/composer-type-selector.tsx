"use client";

import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import type { ComposerAudienceMode } from "../../_components/composer-audience";

/** "Paylaşım" or "Soru": picking a question hands over to the question dialog. */
export function ComposerTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: ComposerAudienceMode;
  onChange: (mode: ComposerAudienceMode) => void;
  disabled: boolean;
}) {
  const t = useTranslations("community");
  const options = (["share", "question"] as const).map((mode) => ({
    mode,
    label: t(mode === "share" ? "composer_share" : "composer_question"),
  }));
  const selectedLabel = options.find((option) => option.mode === value)?.label;

  return (
    <PopoverMenu
      align="left"
      panelRole="listbox"
      menuClassName="w-44"
      trigger={({ open, setOpen, menuId }) => (
        <button
          type="button"
          disabled={disabled}
          aria-label={t("composer_type_label")}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen(!open)}
          className="flex min-h-9 items-center gap-1 rounded-full border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-extrabold text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50"
        >
          {selectedLabel}
          <ChevronDown size={14} aria-hidden />
        </button>
      )}
    >
      {options.map((option) => (
        <PopoverMenuItem
          key={option.mode}
          role="option"
          selected={option.mode === value}
          onClick={() => onChange(option.mode)}
        >
          <span className="flex items-center justify-between gap-3">
            {option.label}
            {option.mode === value ? <Check size={16} aria-hidden /> : null}
          </span>
        </PopoverMenuItem>
      ))}
    </PopoverMenu>
  );
}
