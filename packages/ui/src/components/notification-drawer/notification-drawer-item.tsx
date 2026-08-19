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
    <div
      className="relative overflow-hidden border-b"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* ── Left action (swipe right → mark read/unread) ── */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 flex w-[52px] items-center justify-center"
        style={{
          backgroundColor: "var(--color-progress, #55acee)",
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
            <Check size={18} color="#fff" strokeWidth={2.5} />
          ) : (
            <EyeOff size={18} color="#fff" strokeWidth={2.5} />
          )}
        </span>
      </div>

      {/* ── Right action (swipe left → delete) ── */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 flex w-[60px] items-center justify-center"
        style={{
          backgroundColor: "var(--color-danger)",
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
          <Trash2 size={18} color="#fff" strokeWidth={2} />
        </span>
      </div>

      {/* ── Content (slides) ── */}
      <div
        className="group relative flex cursor-pointer gap-3 px-4 py-3 focus-visible:outline-none"
        style={{
          backgroundColor: isUnread ? "var(--color-surface)" : "transparent",
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
            className="absolute inset-y-0 left-0 w-[52px]"
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
            className="absolute inset-y-0 right-0 w-[60px]"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
          />
        )}

        {/* Unread dot */}
        {isUnread && (
          <span
            aria-hidden
            className="absolute left-3 top-4 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--color-progress)" }}
          />
        )}

        {/* Category icon */}
        <div
          className="ml-3 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)]"
          style={{
            backgroundColor: isUnread
              ? "color-mix(in srgb, var(--color-chip) 30%, transparent)"
              : "color-mix(in srgb, var(--color-main) 8%, transparent)",
          }}
        >
          {renderIcon ? (
            renderIcon(notification.category)
          ) : (
            <Bell
              size={20}
              color={
                isUnread ? "var(--color-chip-text)" : "var(--color-secondary)"
              }
              strokeWidth={2}
              aria-hidden
            />
          )}
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="mb-0.5 flex items-start justify-between gap-2">
            <p
              className="truncate text-sm leading-snug"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: isUnread ? 700 : 400,
                color: isUnread
                  ? "var(--color-main)"
                  : "var(--color-secondary)",
              }}
            >
              {notification.title}
            </p>
            <span
              className="shrink-0 text-[11px] leading-none"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-secondary)",
              }}
            >
              {relativeTime(notification.createdAt, labels)}
            </span>
          </div>
          <p
            className="line-clamp-2 text-sm leading-snug"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--color-secondary)",
            }}
          >
            {notification.body}
          </p>
        </div>

        {/* Desktop action buttons (hidden on mobile, visible on hover) */}
        <div className="ml-1 hidden shrink-0 items-center gap-1 self-center opacity-0 transition-opacity group-hover:opacity-100 lg:flex">
          <button
            type="button"
            aria-label={isUnread ? labels.markRead : labels.markUnread}
            onClick={(e) => {
              e.stopPropagation();
              handleMarkToggle();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2"
            style={{ color: "var(--color-progress)" }}
          >
            {isUnread ? (
              <Check size={15} strokeWidth={2.5} />
            ) : (
              <EyeOff size={15} strokeWidth={2} />
            )}
          </button>
          <button
            type="button"
            aria-label={labels.deleteItem}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] focus-visible:outline-none focus-visible:ring-2"
            style={{ color: "var(--color-danger)" }}
          >
            <Trash2 size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
