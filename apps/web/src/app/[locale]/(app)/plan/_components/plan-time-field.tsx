"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { PopoverMenu } from "@/components/popover-menu";
import { canonicalHm, minuteChoices, pad } from "./plan-time";

const HOURS = Array.from({ length: 24 }, (_, index) => index);

export function PlanTimeField({
  label,
  value,
  required,
  onChange,
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("common.time_picker");
  const labelId = useId();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const parsed = canonicalHm(value);
  const hour = parsed ? Number(parsed.slice(0, 2)) : null;
  const minute = parsed ? Number(parsed.slice(3)) : null;

  function commit(nextHour: number, nextMinute: number) {
    onChange(`${pad(nextHour)}:${pad(nextMinute)}`);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span
        id={labelId}
        className="text-xs font-semibold"
        style={{ color: "var(--color-secondary)", fontFamily: "var(--font-heading)" }}
      >
        {label}
      </span>
      <PopoverMenu
        align="left"
        side="bottom"
        matchTriggerWidth
        panelRole="dialog"
        overflow="hidden"
        open={open}
        onOpenChange={setOpen}
        menuClassName="p-1.5"
        trigger={({ open: menuOpen, setOpen: setMenuOpen, menuId }) => (
          <div className="relative">
            <input
              id={inputId}
              aria-labelledby={labelId}
              required={required}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              value={value}
              placeholder="09:00"
              onChange={(event) => onChange(event.target.value)}
              onBlur={() => {
                const next = canonicalHm(value);
                if (next && next !== value) onChange(next);
              }}
              className="min-h-11 w-full rounded-[var(--radius-card)] border bg-[var(--color-surface-translucent)] py-3 pr-12 pl-5 text-base tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                color: "var(--color-body)",
                boxShadow: "var(--shadow-card)",
                fontFamily: "var(--font-body)",
                borderColor: "var(--color-border)",
              }}
            />
            <button
              type="button"
              aria-label={t("title")}
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              onClick={() => setMenuOpen(!menuOpen)}
              className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[var(--radius-card)] outline-none hover:bg-[color-mix(in_srgb,var(--color-main)_8%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ color: "var(--color-secondary)" }}
            >
              <Clock size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        )}
      >
        <div className="grid grid-cols-2 gap-1">
          <TimeColumn
            label={t("hour")}
            values={HOURS}
            selected={hour}
            onSelect={(nextHour) => commit(nextHour, minute ?? 0)}
          />
          <TimeColumn
            label={t("minute")}
            values={minuteChoices(minute)}
            selected={minute}
            onSelect={(nextMinute) => commit(hour ?? 9, nextMinute)}
          />
        </div>
      </PopoverMenu>
    </div>
  );
}

function TimeColumn({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: readonly number[];
  selected: number | null;
  onSelect: (value: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (selected === null) return;
    const root = scrollerRef.current;
    const node = root?.querySelector<HTMLElement>(`[data-unit="${selected}"]`);
    if (!root || !node) return;
    root.scrollTop = node.offsetTop - root.clientHeight / 2 + node.offsetHeight / 2;
  }, [selected]);

  return (
    <div className="flex min-w-0 flex-col">
      <p className="px-1 pb-1 text-center text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
        {label}
      </p>
      <div
        ref={scrollerRef}
        role="listbox"
        aria-label={label}
        className="h-44 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
      >
        {values.map((unit) => {
          const active = unit === selected;
          return (
            <button
              key={unit}
              type="button"
              role="option"
              data-unit={unit}
              aria-selected={active}
              onClick={() => onSelect(unit)}
              className={`flex h-9 w-full cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-sm tabular-nums transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none ${
                active
                  ? "font-bold"
                  : "font-medium hover:bg-[color-mix(in_srgb,var(--color-main)_8%,transparent)]"
              }`}
              style={{
                background: active ? "var(--play-cta)" : undefined,
                color: active ? "var(--play-cta-ink)" : "var(--color-body)",
              }}
            >
              {pad(unit)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
