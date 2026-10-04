"use client";
import { CheckCheck, X } from "lucide-react";

import type * as React from "react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { NotificationCategory, UserNotificationDto } from "@mentor/types";
import { SlidingTabs } from "../transitions/sliding-tabs.js";
import { NotificationDrawerItem } from "./notification-drawer-item.js";
import type {
  NotificationDrawerDesktopSide,
  NotificationDrawerLabels,
  NotificationTab,
} from "./types.js";

export interface NotificationDrawerPanelProps {
  isOpen: boolean;
  onClose(): void;
  items: UserNotificationDto[];
  unreadCount: number;
  activeTab: NotificationTab;
  onTabChange(tab: NotificationTab): void;
  onMarkRead(id: string): void;
  onMarkUnread(id: string): void;
  onMarkAllRead(): void;
  onDelete(id: string): void;
  onClickItem(notification: UserNotificationDto): void;
  renderIcon?: (category: NotificationCategory) => React.ReactNode;
  emptyState?: React.ReactNode;
  labels: NotificationDrawerLabels;
  desktopSide?: NotificationDrawerDesktopSide;
}

const CLOSE_ANIMATION_MS = 150;

/**
 * Read-state filter, not a category filter — the row icon already carries the category, and a
 * per-category strip could not fit (or stay maintained as) six entries in a 380px panel.
 */
const TABS: {
  id: NotificationTab;
  labelKey: keyof NotificationDrawerLabels;
}[] = [
  { id: "ALL", labelKey: "tabAll" },
  { id: "UNREAD", labelKey: "tabUnread" },
];

type RecencyGroup = "today" | "week" | "earlier";

const GROUP_LABEL_KEY: Record<RecencyGroup, keyof NotificationDrawerLabels> = {
  today: "groupToday",
  week: "groupThisWeek",
  earlier: "groupEarlier",
};

const DAY_MS = 86_400_000;

function recencyGroup(iso: string, now: number): RecencyGroup {
  const age = now - new Date(iso).getTime();
  if (age < DAY_MS) return "today";
  if (age < 7 * DAY_MS) return "week";
  return "earlier";
}

/**
 * Bucket an already-sorted (newest-first) list into recency runs. Derived during render — no
 * state, no effect. Empty buckets are dropped so a list of only old items shows one heading.
 */
export function groupByRecency(
  items: UserNotificationDto[],
  now: number = Date.now(),
): { key: RecencyGroup; items: UserNotificationDto[] }[] {
  const groups: { key: RecencyGroup; items: UserNotificationDto[] }[] = [];
  for (const item of items) {
    const key = recencyGroup(item.createdAt, now);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

export function NotificationDrawerPanel({
  isOpen,
  onClose,
  items,
  unreadCount,
  activeTab,
  onTabChange,
  onMarkRead,
  onMarkUnread,
  onMarkAllRead,
  onDelete,
  onClickItem,
  renderIcon,
  emptyState,
  labels,
  desktopSide = "left",
}: NotificationDrawerPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Body scroll lock on mobile when open
  useEffect(() => {
    if (isOpen) {
      document.documentElement.classList.add("mentor-drawer-open");
    } else {
      document.documentElement.classList.remove("mentor-drawer-open");
    }
    return () => {
      document.documentElement.classList.remove("mentor-drawer-open");
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Focus trap: move focus into panel on open
  useEffect(() => {
    if (isOpen) {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
        "button, [tabindex]:not([tabindex='-1'])",
      );
      firstFocusable?.focus();
    }
  }, [isOpen]);

  function handleClose() {
    setClosing(true);
    // wait for exit animation before unmounting
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, CLOSE_ANIMATION_MS);
  }

  const visibleItems =
    activeTab === "ALL" ? items : items.filter((n) => n.readAt === null);
  const groups = groupByRecency(visibleItems);

  if (!mounted) return null;
  if (!isOpen && !closing) return null;

  const panel = (
    <>
      {/* ── Mobile: scrim ── */}
      <div
        aria-hidden
        className="fixed inset-0 z-40 bg-[var(--color-scrim)] lg:hidden"
        style={{
          animation: closing
            ? "none"
            : "drawer-backdrop-enter 200ms ease-out forwards",
        }}
        onClick={handleClose}
      />
      {/* ── Desktop: transparent click-away overlay ── */}
      <div
        aria-hidden
        className="fixed inset-0 z-40 hidden lg:block"
        onClick={handleClose}
      />

      {/* ── Panel ── */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
        className={[
          // Mobile: fixed right drawer, rounded left edge only
          "fixed inset-y-0 right-0 z-50 flex w-[88vw] max-w-[400px] flex-col overflow-hidden bg-[var(--color-surface)]",
          "max-lg:rounded-l-[var(--play-radius)] shadow-[var(--shadow-overlay)]",
          // Desktop defaults beside the app sidebar; alternate headers can anchor it to the right.
          "lg:inset-y-auto",
          desktopSide === "right"
            ? "lg:left-auto lg:right-4 lg:top-20"
            : "lg:right-auto lg:left-64 lg:top-4",
          "lg:h-auto lg:max-h-[560px] lg:w-[400px] lg:max-w-none",
          "lg:rounded-[var(--play-radius)] lg:border lg:border-[var(--color-border)]",
          closing
            ? "animate-drawer-out lg:animate-popover-out"
            : "animate-drawer-in lg:animate-popover-in",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--play-line)] pb-3 pl-5 pr-2.5 pt-4">
          <h2 className="flex min-w-0 flex-1 items-center gap-2.5 text-base font-extrabold leading-tight text-[var(--color-main)]">
            {labels.title}
            {unreadCount > 0 && (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--play-selected)] px-2 text-xs font-extrabold text-[var(--play-selected-ink)]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </h2>

          {unreadCount > 0 && (
            // Words on desktop; the 88vw phone drawer keeps the glyph and gives the words to readers.
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] px-1 text-sm font-extrabold text-[var(--play-selected-ink)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <CheckCheck size={22} strokeWidth={1.75} aria-hidden className="lg:hidden" />
              <span className="max-lg:sr-only">{labels.markAllRead}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label={labels.close}
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-[var(--color-secondary)] outline-none transition-colors hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          >
            <X size={22} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <SlidingTabs
          variant="underline"
          className="shrink-0"
          ariaLabel={labels.title}
          idPrefix="notification-drawer-tab"
          value={activeTab}
          onChange={(id) => onTabChange(id as NotificationTab)}
          items={TABS.map((tab) => ({
            id: tab.id,
            label: labels[tab.labelKey] as string,
            panelId: "notification-drawer-panel",
          }))}
        />

        <div
          id="notification-drawer-panel"
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ scrollbarWidth: "none" }}
          role="tabpanel"
        >
          {visibleItems.length === 0
            ? (emptyState ?? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <p className="mb-1 text-base font-extrabold text-[var(--color-main)]">
                    {labels.emptyTitle}
                  </p>
                  <p className="text-body-sm font-semibold text-[var(--color-secondary)]">
                    {labels.emptyBody}
                  </p>
                </div>
              ))
            : groups.map((group) => (
                <section key={group.key}>
                  <h3 className="sticky top-0 z-10 bg-[var(--color-surface)] px-5 pb-1.5 pt-3.5 text-caption font-extrabold text-[var(--color-secondary)]">
                    {labels[GROUP_LABEL_KEY[group.key]] as string}
                  </h3>
                  {group.items.map((n) => (
                    <NotificationDrawerItem
                      key={n.id}
                      notification={n}
                      onMarkRead={onMarkRead}
                      onMarkUnread={onMarkUnread}
                      onDelete={onDelete}
                      onClickItem={onClickItem}
                      renderIcon={renderIcon}
                      labels={labels}
                    />
                  ))}
                </section>
              ))}
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
