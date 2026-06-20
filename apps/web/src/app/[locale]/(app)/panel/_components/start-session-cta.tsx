import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { SessionPresetDto } from "@mentor/types";
import { Card } from "@mentor/ui";

function PlayIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

/**
 * Pomodoro entry CTA — Link styled with primary Button tokens (valid HTML: no nested button).
 */
export function StartSessionCta({ presets }: { presets: SessionPresetDto[] }) {
  const translate = useTranslations("start_session");
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <p
            className="text-base font-bold"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {translate("title")}
          </p>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--color-secondary)" }}
          >
            {translate("subtitle")}
          </p>
        </div>

        <Link
          href="/seans"
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 motion-reduce:transition-none"
          style={{
            backgroundColor: "var(--color-btn)",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
          }}
        >
          <PlayIcon />
          {translate("cta")}
        </Link>

        <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {translate("duration_prefix", {
            durations: presets.map((p) => p.label).join(" · "),
          })}
        </p>
      </div>
    </Card>
  );
}
