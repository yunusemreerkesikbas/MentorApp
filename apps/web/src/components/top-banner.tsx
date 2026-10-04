"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, X } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { readIdSet, writeIdSet } from "@/lib/seen-ids";
import { advanceTopBannerIndex } from "@/lib/top-banner-state";

/**
 * v2 holds a JSON array of dismissed item ids; v1 held a single "1" meaning "hide everything".
 * The bump IS the migration — a stale v1 value is simply ignored, and it dies with the tab anyway.
 */
const DISMISS_KEY = "mentor.dashboard-top-banner.dismissed.v2";
const DEFAULT_ROTATION_INTERVAL_MS = 5_000;

/** Nothing external ever mutates this; the hook is here purely for a hydration-safe first paint. */
const subscribeHydrated = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerHydratedSnapshot = () => false;

function readDismissedIds(): ReadonlySet<string> {
  return readIdSet("session", DISMISS_KEY);
}

type TopBannerAction =
  | { kind: "button"; label: string; onSelect: () => void }
  | { kind: "link"; label: string; href: ComponentProps<typeof Link>["href"] };

export interface TopBannerItem {
  id: string;
  message: string;
  action: TopBannerAction;
  /** Card headline above the message. */
  title?: string;
  /** Illustration in the slide's band: beside the text on phones, above it in the rail. */
  visual?: ReactNode;
}

interface TopBannerProps {
  closeLabel: string;
  items: TopBannerItem[];
  rotationIntervalMs?: number;
}

const ACTION_CLASS =
  "mt-1 inline-flex h-11 w-fit cursor-pointer items-center gap-1 rounded-[var(--play-radius)] bg-[var(--play-cta)] px-4 text-sm font-extrabold text-[var(--play-cta-ink)] shadow-[0_4px_0_var(--play-cta-edge)] outline-none transition-[transform,box-shadow] duration-[120ms] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:translate-y-1 active:shadow-none motion-reduce:transition-none";

/**
 * The panel's announcement card (it used to be a one-line strip across the top, hence the name
 * and the testid, both kept so nothing that watches it has to move). Several announcements take
 * turns in one card: they rotate every 5s, stop while hovered or focused, and each one is closed on
 * its own for the rest of the tab session.
 *
 * Every slide stays mounted in one grid cell and only the current one is visible, so the card is
 * as tall as its tallest slide: a rotation never moves the cards below it.
 */
export function TopBanner({
  closeLabel,
  items,
  rotationIntervalMs = DEFAULT_ROTATION_INTERVAL_MS,
}: TopBannerProps) {
  const t = useTranslations("ads.top_banner");
  // Rendered empty on the server and on the hydrating pass, so a dismissal stored in this tab
  // never flashes the card before React catches up.
  const hydrated = useSyncExternalStore(
    subscribeHydrated,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(readDismissedIds);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Closing one announcement must not silence the others — each item is dismissed on its own id.
  const visibleItems = useMemo(
    () => items.filter((item) => !dismissedIds.has(item.id)),
    [dismissedIds, items],
  );
  const safeIndex = visibleItems.length > 0 ? currentIndex % visibleItems.length : 0;
  const currentItem = visibleItems[safeIndex];

  useEffect(() => {
    if (visibleItems.length <= 1 || paused || !hydrated) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => advanceTopBannerIndex(index, visibleItems.length));
    }, rotationIntervalMs);
    return () => window.clearInterval(timer);
  }, [hydrated, paused, rotationIntervalMs, visibleItems.length]);

  function dismissItem(id: string) {
    const next = new Set(dismissedIds).add(id);
    setDismissedIds(next);
    // Land on the item that slid into this slot rather than skipping one.
    setCurrentIndex(0);
    writeIdSet("session", DISMISS_KEY, next);
  }

  if (!hydrated || !currentItem) return null;

  return (
    <section
      aria-label={t("label")}
      className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
      data-testid="dashboard-top-banner"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onFocusCapture={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        aria-label={closeLabel}
        className="absolute right-2 top-2 z-[2] grid size-9 place-items-center rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)] text-[var(--color-secondary)] outline-none hover:text-[var(--color-main)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        onClick={() => dismissItem(currentItem.id)}
        type="button"
      >
        <X aria-hidden size={16} />
      </button>

      <div className="grid" aria-live="off">
        {visibleItems.map((item, index) => {
          const active = index === safeIndex;
          return (
            <div
              key={item.id}
              aria-hidden={!active}
              inert={!active}
              className={`flex gap-4 p-4 pr-12 transition-[opacity,transform,visibility] duration-300 ease-out [grid-area:1/1] motion-reduce:transition-none xl:flex-col xl:gap-0 xl:p-0 ${active ? "visible translate-x-0 opacity-100" : "invisible translate-x-3 opacity-0"}`}
            >
              {item.visual ? (
                <div className="grid size-20 shrink-0 place-items-center rounded-[var(--radius-card)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--blob-cyan)_55%,var(--color-surface)),color-mix(in_srgb,var(--play-well-violet)_85%,var(--color-surface)))] xl:h-28 xl:w-full xl:rounded-none">
                  {item.visual}
                </div>
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 xl:px-5 xl:pb-4 xl:pt-4">
                {item.title ? (
                  <p className="text-base font-extrabold leading-snug text-[var(--color-main)]">
                    {item.title}
                  </p>
                ) : null}
                <p
                  className={
                    item.title
                      ? "text-sm leading-6 text-[var(--color-body)]"
                      : "pr-6 text-base font-extrabold leading-snug text-[var(--color-main)] xl:pr-0"
                  }
                >
                  {item.message}
                </p>
                {item.action.kind === "link" ? (
                  <Link className={ACTION_CLASS} href={item.action.href}>
                    {item.action.label}
                    <ChevronRight className="size-4" strokeWidth={2.5} aria-hidden />
                  </Link>
                ) : (
                  <button className={ACTION_CLASS} onClick={item.action.onSelect} type="button">
                    {item.action.label}
                    <ChevronRight className="size-4" strokeWidth={2.5} aria-hidden />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visibleItems.length > 1 ? (
        <div className="flex justify-center gap-1.5 pb-3.5">
          {visibleItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={t("slide", { index: index + 1, total: visibleItems.length })}
              aria-current={index === safeIndex ? "true" : undefined}
              onClick={() => setCurrentIndex(index)}
              className="grid h-6 cursor-pointer place-items-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <span
                className={`block h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none ${index === safeIndex ? "w-5 bg-[var(--play-cta)]" : "w-1.5 bg-[var(--play-line)]"}`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
