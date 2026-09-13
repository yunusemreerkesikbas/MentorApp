"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { PopoverMenu } from "@/components/popover-menu";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const PANEL_WIDTH = 176;

export function TimeField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("common.time_picker");
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const parsed = parseHm(value);
  const display = value ? formatHm(parsed.hour, parsed.minute) : "";

  function commit(next: { hour: number; minute: number }) {
    onChange(formatHm(next.hour, next.minute));
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span id={labelId} className="text-xs font-semibold text-zinc-500">
        {label}
      </span>
      <PopoverMenu
        align="left"
        side="bottom"
        panelRole="dialog"
        panelWidth={PANEL_WIDTH}
        overflow="hidden"
        open={open}
        onOpenChange={setOpen}
        menuClassName="w-44 p-1.5"
        trigger={({ open: menuOpen, setOpen: setMenuOpen, menuId }) => (
          <div className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-zinc-200/80 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
            <span className="min-w-0 flex-1 truncate text-sm tabular-nums">
              {display || (
                <span className="text-zinc-400 dark:text-zinc-500">--:--</span>
              )}
            </span>
            <button
              type="button"
              disabled={disabled}
              aria-labelledby={labelId}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              data-time={value}
              onClick={() => {
                if (!disabled) setMenuOpen(!menuOpen);
              }}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-500"
            >
              <Clock className="size-5 text-zinc-500" strokeWidth={2} aria-hidden />
              <span className="sr-only">{t("title")}</span>
            </button>
          </div>
        )}
      >
        <div className="grid grid-cols-2 gap-1">
          <TimeColumn
            label={t("hour")}
            values={HOURS}
            selected={value ? parsed.hour : null}
            onSelect={(hour) =>
              commit({ hour, minute: snapMinute(parsed.minute) })
            }
          />
          <TimeColumn
            label={t("minute")}
            values={MINUTES}
            selected={value ? snapMinute(parsed.minute) : null}
            onSelect={(minute) =>
              commit({ hour: value ? parsed.hour : 9, minute })
            }
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
      <p className="px-1 pb-1 text-center text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
        {label}
      </p>
      <div
        ref={scrollerRef}
        role="listbox"
        aria-label={label}
        className="h-52 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
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
              className={`flex h-9 w-full cursor-pointer items-center justify-center rounded-lg text-sm tabular-nums transition-colors duration-150 motion-reduce:transition-none ${
                active
                  ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950"
                  : "font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              }`}
            >
              {pad(unit)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function parseHm(value: string): { hour: number; minute: number } {
  const [rawHour, rawMinute] = value.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  return {
    hour: Number.isFinite(hour) ? clamp(hour, 0, 23) : 9,
    minute: Number.isFinite(minute) ? clamp(minute, 0, 59) : 0,
  };
}

function snapMinute(minute: number): number {
  return clamp(Math.round(minute / 5) * 5, 0, 55);
}

function formatHm(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
