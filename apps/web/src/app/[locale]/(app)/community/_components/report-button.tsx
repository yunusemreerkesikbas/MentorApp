"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ModerationTargetType, ReportReason } from "@mentor/types";
import { createReport } from "@/lib/forum";

const REASONS: { value: ReportReason; key: string }[] = [
  { value: ReportReason.SPAM, key: "report_spam" },
  { value: ReportReason.HARASSMENT, key: "report_harassment" },
  { value: ReportReason.OFF_TOPIC, key: "report_off_topic" },
  { value: ReportReason.OTHER, key: "report_other" },
];

/** Inline report control — a text trigger that expands to reason chips (no modal infra). Idempotent. */
export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: ModerationTargetType;
  targetId: string;
}) {
  const t = useTranslations("community");
  const [mode, setMode] = useState<"idle" | "open" | "done">("idle");
  const [busy, setBusy] = useState(false);

  if (mode === "done") {
    return (
      <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {t("report_done")}
      </span>
    );
  }

  if (mode === "idle") {
    return (
      <button
        type="button"
        onClick={() => setMode("open")}
        className="text-xs underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-secondary)" }}
      >
        {t("report")}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {t("report_reason")}:
      </span>
      {REASONS.map((r) => (
        <button
          key={r.value}
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await createReport(targetType, targetId, r.value);
              setMode("done");
            } catch {
              setMode("done"); // idempotent — re-report is a no-op server-side
            }
          }}
          className="rounded-[var(--radius-card)] border px-2 py-1 text-xs transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60 motion-reduce:transition-none"
          style={{ borderColor: "color-mix(in srgb, var(--color-main) 12%, transparent)", color: "var(--color-main)" }}
        >
          {t(r.key as `report_${string}`)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setMode("idle")}
        className="text-xs hover:underline"
        style={{ color: "var(--color-secondary)" }}
      >
        {t("report_cancel")}
      </button>
    </div>
  );
}
