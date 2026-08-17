"use client";

import { Check, ChevronDown, Lock, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ZoneView } from "@mentor/types";
import { ZoneTypeIcon } from "./zone-type-icon";

function zoneIconTone(type: ZoneView["type"]): string {
  if (type === "CHAT") return "text-[var(--community-blue-ink)]";
  if (type === "QA") return "text-[var(--community-coral)]";
  return "text-[var(--community-green)]";
}

export function AudienceSelector({
  zones,
  value,
  onChange,
  locked = false,
  disabled = false,
}: {
  zones: ZoneView[];
  value: string;
  onChange?: (zoneId: string) => void;
  locked?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("community");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = zones.find((zone) => zone.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>("[role='option']")?.focus();
  }, [open]);

  if (locked) {
    return (
      <div
        className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border border-[var(--community-blue-border)] bg-[var(--community-blue-soft)] px-3 text-xs font-bold text-[var(--community-blue-ink)]"
        aria-label={t("audience_locked_label", { name: selected?.title ?? "" })}
      >
        {selected ? <ZoneTypeIcon type={selected.type} size={14} aria-hidden /> : null}
        <span className="truncate">{selected?.title}</span>
        <Lock size={13} aria-hidden />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative flex min-h-11 items-center">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-8 max-w-full items-center gap-1.5 rounded-full border border-[var(--community-blue-border)] bg-[var(--community-blue-soft)] px-2.5 text-xs font-bold text-[var(--community-blue-ink)] after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selected ? <ZoneTypeIcon type={selected.type} size={13} aria-hidden /> : null}
        <span className="truncate">{selected?.title ?? t("audience_choose")}</span>
        <ChevronDown size={15} aria-hidden />
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="listbox"
          aria-label={t("audience_label")}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            const options = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>("[role='option']") ?? []);
            const current = options.indexOf(document.activeElement as HTMLButtonElement);
            const offset = event.key === "ArrowDown" ? 1 : -1;
            options[(current + offset + options.length) % options.length]?.focus();
            event.preventDefault();
          }}
          className="fixed inset-x-3 bottom-3 z-50 max-h-[70vh] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-card)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-[calc(100%+0.5rem)] sm:max-h-80 sm:w-80"
        >
          <p className="px-3 py-2 text-sm font-extrabold text-[var(--color-main)]">
            {t("audience_choose")}
          </p>
          {zones.map((zone) => (
            <button
              key={zone.id}
              type="button"
              role="option"
              aria-selected={zone.id === value}
              onClick={() => {
                onChange?.(zone.id);
                setOpen(false);
              }}
              className="flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-card)] px-3 text-left hover:bg-[var(--color-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
            >
              <span className={`grid size-6 shrink-0 place-items-center ${zoneIconTone(zone.type)}`} aria-hidden>
                <ZoneTypeIcon type={zone.type} size={16} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[var(--color-main)]">{zone.title}</span>
                <span className="flex items-center gap-1 text-xs text-[var(--color-secondary)]">
                  <Users size={12} aria-hidden /> {t("audience_members", { count: zone.memberCount })}
                </span>
              </span>
              {zone.id === value ? <Check size={17} aria-hidden /> : null}
            </button>
          ))}
          {zones.length === 0 ? (
            <p className="px-3 py-4 text-sm text-[var(--color-secondary)]">{t("composer_no_zone")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
