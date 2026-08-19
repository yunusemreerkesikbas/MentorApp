"use client";
import { X } from "lucide-react";

import type * as React from "react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { NotificationCategory, UserNotificationDto } from "@mentor/types";
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

const CLOSE_ANIMATION_MS = 220;

const TABS: {
  id: NotificationTab;
  labelKey: keyof NotificationDrawerLabels;
}[] = [
  { id: "ALL", labelKey: "tabAll" },
  { id: "COACH", labelKey: "tabCoach" },
  { id: "PLAN", labelKey: "tabPlan" },
];

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
    activeTab === "ALL" ? items : items.filter((n) => n.category === activeTab);

  if (!mounted) return null;
  if (!isOpen && !closing) return null;

  const panel = (
    <>
      {/* ── Mobile: blurred backdrop ── */}
      <div
        aria-hidden
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[6px] lg:hidden"
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
          "fixed inset-y-0 right-0 z-50 flex w-[85vw] max-w-[320px] flex-col bg-[var(--color-surface)]",
          "max-lg:rounded-l-[16px]",
          "shadow-[-8px_0_24px_rgba(0,0,0,0.10)]",
          // Desktop defaults beside the app sidebar; alternate headers can anchor it to the right.
          "lg:inset-y-auto",
          desktopSide === "right"
            ? "lg:left-auto lg:right-4 lg:top-20"
            : "lg:right-auto lg:left-64 lg:top-4",
          "lg:h-auto lg:max-h-[560px] lg:w-[380px] lg:max-w-none",
          "lg:rounded-[var(--radius-card)] lg:shadow-[0_8px_32px_rgba(0,0,0,0.14)]",
          closing
            ? "animate-drawer-out lg:animate-popover-out"
            : "animate-drawer-in lg:animate-popover-in",
        ].join(" ")}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-4 lg:rounded-t-[var(--radius-card)]"
          style={{
            borderColor:
              "color-mix(in srgb, var(--color-main) 8%, transparent)",
          }}
        >
          <h2
            className="text-base font-bold leading-tight"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--color-main)",
            }}
          >
            {labels.title}
            {unreadCount > 0 && (
              <span
                className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
                style={{ backgroundColor: "var(--color-progress)" }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs font-bold transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-1"
                style={{
                  color: "var(--color-progress)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {labels.markAllRead}
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              aria-label={labels.close}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-1"
              style={{ color: "var(--color-secondary)" }}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label={labels.title}
          className="flex shrink-0 border-b px-4"
          style={{
            borderColor:
              "color-mix(in srgb, var(--color-main) 10%, transparent)",
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative mr-5 py-3 text-[11px] font-bold uppercase tracking-widest transition-colors last:mr-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-1"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: isActive
                    ? "var(--color-main)"
                    : "var(--color-secondary)",
                }}
                aria-selected={isActive}
                role="tab"
              >
                {labels[tab.labelKey] as string}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-px h-0.5"
                    style={{ backgroundColor: "var(--color-main)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Notification list */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ scrollbarWidth: "none" }}
          role="tabpanel"
        >
          {visibleItems.length === 0
            ? (emptyState ?? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <p
                    className="mb-1 text-base font-bold"
                    style={{
                      fontFamily: "var(--font-heading)",
                      color: "var(--color-main)",
                    }}
                  >
                    {labels.emptyTitle}
                  </p>
                  <p
                    className="text-sm"
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "var(--color-secondary)",
                    }}
                  >
                    {labels.emptyBody}
                  </p>
                </div>
              ))
            : visibleItems.map((n) => (
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
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
