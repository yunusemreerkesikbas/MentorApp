"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { firstName, greetingKeyForHour } from "@/lib/greeting";
import { MOOD_WHEEL_OPTIONS } from "./mood-assets";

type MoodLabelKey = `option_${1 | 2 | 3 | 4 | 5}`;

/**
 * The page's own "Günaydın": name, date and today's mood in one tap. Not a card, the page is
 * speaking. Phones already greet in the top bar, so there only the mood row is visible (the
 * heading stays for screen readers).
 */
export function GreetingRow({
  mood,
  busy,
  canLighten,
  onPick,
}: {
  mood: number | null;
  busy: boolean;
  /** Today still has a pending task, the only thing a low-mood adaptation can lighten. */
  canLighten: boolean;
  onPick: (value: number) => void;
}) {
  const t = useTranslations("panel");
  const moodT = useTranslations("mood");
  const locale = useLocale();
  const { user } = useAuth();
  const name = user ? firstName(user.displayName) : "";
  const today = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="sr-only text-display font-extrabold leading-tight tracking-[-0.01em] text-[var(--color-main)] lg:not-sr-only lg:truncate">
            {t(greetingKeyForHour(), { name })}
          </h1>
          <p className="mt-1 hidden text-sm font-bold text-[var(--color-secondary)] lg:block">
            {today}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-[var(--play-radius)] border border-[var(--play-line)] bg-[var(--color-surface)] py-1 pl-3.5 pr-1 lg:justify-start lg:border-0 lg:bg-transparent lg:p-0">
          <span className="text-sm font-extrabold text-[var(--color-body)]">
            {moodT("title")}
          </span>
          <div
            role="group"
            aria-label={t("mood_group_label")}
            className="flex gap-0.5 lg:rounded-[var(--play-radius)] lg:border lg:border-[var(--play-line)] lg:bg-[var(--color-surface)] lg:p-1"
          >
            {MOOD_WHEEL_OPTIONS.map((option) => {
              const selected = mood === option.value;
              const label = moodT(`option_${option.value}` as MoodLabelKey);
              return (
                <div key={option.value} className="group relative flex items-center justify-center">
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={selected}
                    aria-label={label}
                    onClick={() => onPick(option.value)}
                    data-testid={`mood-option-${option.value}`}
                    className={[
                      "grid size-10 cursor-pointer place-items-center rounded-[var(--radius-card)] transition-[transform,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-wait motion-reduce:transition-none sm:size-11",
                      selected
                        ? "bg-[var(--play-selected)] shadow-[inset_0_0_0_2px_var(--play-cta)]"
                        : "hover:-translate-y-0.5 hover:bg-[var(--play-track)]",
                      mood != null && !selected ? "opacity-60 hover:opacity-100" : "",
                    ].join(" ")}
                  >
                    <Image
                      src={option.src}
                      alt=""
                      width={32}
                      height={32}
                      className="size-7 object-contain sm:size-8"
                      draggable={false}
                    />
                  </button>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 z-30 -translate-x-1/2 translate-y-1 scale-95 whitespace-nowrap rounded-[var(--radius-card)] bg-[var(--color-main)] px-2 py-0.5 text-xs font-bold text-[var(--color-bg)] opacity-0 shadow-[var(--shadow-card)] transition-all duration-150 ease-out group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100 motion-reduce:transition-none motion-reduce:transform-none"
                  >
                    {label}
                    <span
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-[var(--color-main)]"
                      aria-hidden
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {canLighten && mood != null && mood <= 2 ? (
        <Link
          href={{ pathname: "/plan", query: { coach: "adapt", source: "mood" } }}
          className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-progress-track)] bg-[var(--color-surface)] px-4 py-3 text-sm font-bold text-[var(--color-main)] shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          {t("coach_adaptation_mood_cta")}
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
