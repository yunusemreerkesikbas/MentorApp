"use client";

import { useTranslations } from "next-intl";
import type { ExamType } from "@mentor/types";
import { EXAM_FAMILIES } from "@/lib/content-api";

export function FamilyFilterBar({
  value,
  onChange,
}: {
  value: ExamType;
  onChange: (family: ExamType) => void;
}) {
  const t = useTranslations("knowledge");

  return (
    <div className="overflow-x-auto">
      <div
        role="tablist"
        aria-label={t("families_label")}
        className="flex min-h-11 gap-1 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        {EXAM_FAMILIES.map((family) => {
          const selected = family === value;
          return (
            <button
              key={family}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(family)}
              className="min-h-11 shrink-0 cursor-pointer px-4 text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              style={{
                color: selected ? "var(--color-main)" : "var(--color-secondary)",
                fontFamily: "var(--font-heading)",
                boxShadow: selected
                  ? "inset 0 -2px 0 var(--color-main)"
                  : undefined,
              }}
            >
              {t(`families.${family.toLowerCase()}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
