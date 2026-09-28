"use client";
import { Bell, Check, EyeOff, Trash2 } from "lucide-react";

import type * as React from "react";
import { useRef, useState } from "react";
import type { NotificationCategory, UserNotificationDto } from "@mentor/types";
import type { NotificationDrawerLabels } from "./types.js";

export interface NotificationDrawerItemProps {
  notification: UserNotificationDto;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onDelete: (id: string) => void;
  onClickItem: (notification: UserNotificationDto) => void;
  renderIcon?: (category: NotificationCategory) => React.ReactNode;
  labels: Pick<
    NotificationDrawerLabels,
    | "timeJustNow"
    | "timeHoursAgo"
    | "timeYesterday"
    | "timeDaysAgo"
    | "markRead"
    | "markUnread"
    | "deleteItem"
  >;
}

const SNAP_LEFT = -60; // reveals delete button
const SNAP_RIGHT = 52; // reveals mark button
const THRESHOLD = 40; // minimum swipe to snap open
const AUTO_LEFT = -110; // full swipe left  → delete immediately
const AUTO_RIGHT = 100; // full swipe right → mark read/unread immediately

function relativeTime(
  iso: string,
  labels: NotificationDrawerItemProps["labels"],
): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) return labels.timeJustNow;
  if (diffH < 24) return labels.timeHoursAgo(diffH);
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return labels.timeYesterday;
  return labels.timeDaysAgo(diffD);
}

export function NotificationDrawerItem({
  notification,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onClickItem,
  renderIcon,
  labels,
}: NotificationDrawerItemProps) {
  const isUnread = notification.readAt === null;
  const [offsetX, setOffsetX] = useState(0);
  const touchStartX = useRef(0);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const delta =
      (e.touches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    setOffsetX(Math.max(AUTO_LEFT, Math.min(AUTO_RIGHT, delta)));
  }

  function handleTouchEnd() {
    if (offsetX <= AUTO_LEFT) {
      setOffsetX(0);
      handleDelete();
    } else if (offsetX <= -THRESHOLD) {
      setOffsetX(SNAP_LEFT);
    } else if (offsetX >= AUTO_RIGHT) {
      setOffsetX(0);
      handleMarkToggle();
    } else if (offsetX >= THRESHOLD) {
      setOffsetX(SNAP_RIGHT);
    } else {
      setOffsetX(0);
    }
  }

  function handleMarkToggle() {
    setOffsetX(0);
    if (isUnread) onMarkRead(notification.id);
    else onMarkUnread(notification.id);
  }

  function handleDelete() {
    setOffsetX(0);
    onDelete(notification.id);
  }

  const revealingLeft = offsetX > 0;
  const revealingRight = offsetX < 0;

  return (
    <div className="relative overflow-hidden">
      {/* ── Left action (swipe right → mark read/unread) ── */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 flex w-[52px] items-center justify-center bg-[var(--play-cta)] text-[var(--play-cta-ink)]"
        style={{
          opacity: revealingLeft ? 1 : 0,
          transition: "opacity 150ms ease",
        }}
      >
        <span
          style={{
            transform: offsetX >= SNAP_RIGHT ? "scale(1)" : "scale(0.7)",
            transition: "transform 180ms cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {isUnread ? (
            <Check size={20} strokeWidth={2} />
          ) : (
            <EyeOff size={20} strokeWidth={2} />
          )}
        </span>
      </div>

      {/* ── Right action (swipe left → delete) ── */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 flex w-[60px] items-center justify-center bg-[var(--color-danger)] text-[var(--color-danger-ink)]"
        style={{
          opacity: revealingRight ? 1 : 0,
          transition: "opacity 150ms ease",
        }}
      >
        <span
          style={{
            transform: offsetX <= SNAP_LEFT ? "scale(1)" : "scale(0.7)",
            transition: "transform 180ms cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <Trash2 size={20} strokeWidth={2} />
        </span>
      </div>

      {/* ── Content (slides) ──
          The fill stays opaque in both read states: it is what hides the swipe actions
          underneath. Unread rows take a tint of the selected fill (mixed into the surface, so still
          opaque), a heavier title and the dot. */}
      <div
        className={`group relative flex cursor-pointer items-start gap-3 px-5 py-3 transition-colors focus-visible:outline-none ${isUnread ? "bg-[color-mix(in_srgb,var(--play-selected)_45%,var(--color-surface))] hover:bg-[color-mix(in_srgb,var(--play-selected)_70%,var(--color-surface))]" : "bg-[var(--color-surface)] hover:bg-[color-mix(in_srgb,var(--color-main)_4%,var(--color-surface))]"}`}
        style={{
          transform: `translateX(${offsetX}px)`,
          willChange: "transform",
          transition:
            offsetX === 0 || offsetX === SNAP_LEFT || offsetX === SNAP_RIGHT
              ? "transform 240ms cubic-bezier(0.34,1.56,0.64,1)"
              : "none",
          touchAction: "pan-y",
        }}
        // Touch (mobile swipe)
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        // Tap to collapse if swiped open, otherwise navigate
        onClick={() => {
          if (offsetX !== 0) {
            setOffsetX(0);
            return;
          }
          onClickItem(notification);
        }}
        // Swipe action buttons (tapped when revealed)
        tabIndex={-1}
      >
        {/* Snap-target buttons (invisible, cover the action zones when revealed) */}
        {offsetX === SNAP_RIGHT && (
          <button
            type="button"
            aria-label={isUnread ? labels.markRead : labels.markUnread}
            className="absolute inset-y-0 left-0 z-10 w-[52px]"
            onClick={(e) => {
              e.stopPropagation();
              handleMarkToggle();
            }}
          />
        )}
        {offsetX === SNAP_LEFT && (
          <button
            type="button"
            aria-label={labels.deleteItem}
            className="absolute inset-y-0 right-0 z-10 w-[60px]"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
          />
        )}

        {/* Category icon — bare line glyph, no well (overlay kit, DESIGN.md §6.1). */}
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center">
          {renderIcon ? (
            renderIcon(notification.category)
          ) : (
            <Bell size={22} color="var(--color-secondary)" strokeWidth={1.75} aria-hidden />
          )}
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1">
          <p
            className={`line-clamp-2 text-sm leading-snug text-[var(--color-main)] ${isUnread ? "font-extrabold" : "font-bold"}`}
          >
            {notification.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-caption font-semibold text-[var(--color-secondary)]">
            {notification.body}
          </p>
        </div>

        {/* Time over the unread dot, one column on the right. */}
        <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
          <span className="whitespace-nowrap text-xs font-bold text-[var(--color-secondary)]">
            {relativeTime(notification.createdAt, labels)}
          </span>
          {isUnread && <span aria-hidden className="size-2 rounded-full bg-[var(--play-cta)]" />}
        </div>

        {/* Desktop action buttons — absolutely positioned over an opaque pill so they cover the
            time and dot column on hover instead of fighting it for the same space. */}
        <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-1 opacity-0 shadow-[var(--shadow-card)] transition-opacity group-hover:opacity-100 lg:flex">
          <button
            type="button"
            aria-label={isUnread ? labels.markRead : labels.markUnread}
            onClick={(e) => {
              e.stopPropagation();
              handleMarkToggle();
            }}
            className="flex size-8 cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-[var(--play-selected-ink)] transition-colors hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {isUnread ? (
              <Check size={18} strokeWidth={1.75} />
            ) : (
              <EyeOff size={18} strokeWidth={1.75} />
            )}
          </button>
          <button
            type="button"
            aria-label={labels.deleteItem}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="flex size-8 cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-[var(--color-danger)] transition-colors hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <Trash2 size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
