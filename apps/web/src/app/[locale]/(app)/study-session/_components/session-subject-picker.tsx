"use client";
import { BookOpen, ChevronDown } from "lucide-react";

import { useTranslations } from "next-intl";
import { Skeleton } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { useExamSubjectTaxonomy } from "@/lib/use-exam-subject-taxonomy";
import {
  SESSION_CHROME_PILL_CLASS,
  SESSION_CHROME_PILL_STYLE,
} from "./session-chrome-pill";

export interface SessionSubjectPickerProps {
  value: string;
  onChange: (next: string) => void;
  /** Focus overlay — display only; session subject is already persisted. */
  readOnly?: boolean;
}

/**
 * Compact subject pill for the timer chrome (roadmap §256).
 */
export function SessionSubjectPicker({
  value,
  onChange,
  readOnly = false,
}: SessionSubjectPickerProps) {
  const t = useTranslations("session");
  const { subjects, needsExamType, loaded } = useExamSubjectTaxonomy();
  const label = value.trim() ? value : t("subject_none");

  if (!loaded) {
    return <Skeleton className="h-11 w-28 rounded-full" />;
  }

  const triggerBody = (
    <>
      <BookOpen className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </>
  );

  if (readOnly) {
    return (
      <span
        className={`${SESSION_CHROME_PILL_CLASS} cursor-default`}
        style={SESSION_CHROME_PILL_STYLE}
      >
        {triggerBody}
      </span>
    );
  }

  if (needsExamType || subjects.length === 0) {
    return (
      <div className="flex max-w-[12.5rem] flex-col gap-1">
        <span
          className={`${SESSION_CHROME_PILL_CLASS} cursor-default`}
          style={SESSION_CHROME_PILL_STYLE}
        >
          {triggerBody}
        </span>
        {needsExamType ? (
          <Link
            href="/settings"
            className="px-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-progress)" }}
          >
            {t("subject_pick_cta")}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <PopoverMenu
      align="left"
      panelRole="listbox"
      menuClassName="min-w-[12.5rem] max-h-64 overflow-y-auto"
      trigger={({ open, setOpen, menuId }) => (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={t("subject_pick_label")}
          onClick={() => setOpen(!open)}
          className={SESSION_CHROME_PILL_CLASS}
          style={SESSION_CHROME_PILL_STYLE}
        >
          {triggerBody}
          <ChevronDown
            className={`size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
            strokeWidth={2.25}
            aria-hidden
            style={{ color: "var(--color-secondary)" }}
          />
        </button>
      )}
    >
      {subjects.map((subject) => (
        <PopoverMenuItem
          key={subject.slug}
          role="option"
          selected={value === subject.name}
          onClick={() => onChange(value === subject.name ? "" : subject.name)}
        >
          {subject.name}
        </PopoverMenuItem>
      ))}
    </PopoverMenu>
  );
}
