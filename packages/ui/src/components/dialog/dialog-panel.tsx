"use client";

import { useId } from "react";
import { Button } from "../button.js";
import { Chip } from "../chip.js";
import type { DialogRecord } from "./types.js";

export interface DialogPanelProps {
  dialog: DialogRecord;
  onAction: (actionId: string) => void;
}

/** Text action beside the ledge ("Vazgeç"): quiet ink, 44px target, never a second ledge. */
const LINK_ACTION =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] px-1 text-body-sm font-extrabold text-[var(--color-secondary)] underline-offset-4 outline-none hover:text-[var(--color-main)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Dialog card (overlay kit, DESIGN.md §6.1): solid surface, one overlay shadow, one filled ledge
 * and text actions beside it. Standard reads left to right; promo centres on a 72px hero.
 */
export function DialogPanel({ dialog, onAction }: DialogPanelProps) {
  const titleId = useId();
  const isPromo = dialog.layout === "promo";
  const hasDanger = dialog.actions.some((action) => action.variant === "danger");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-mentor-dialog-panel
      className={`relative flex w-full flex-col gap-3.5 rounded-[var(--play-radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-overlay)] transition-opacity duration-150 motion-reduce:transition-none ${isPromo ? "items-center text-center" : ""} ${dialog.exiting ? "opacity-0" : "animate-dialog-enter motion-reduce:animate-none"}`}
      onClick={(e) => e.stopPropagation()}
    >
      {dialog.hero ? <div className="size-[72px] shrink-0">{dialog.hero}</div> : null}
      {dialog.leading && !isPromo ? (
        <div className="flex size-8 shrink-0 items-center">{dialog.leading}</div>
      ) : null}

      <h2 id={titleId} className="text-xl font-extrabold leading-snug text-[var(--color-main)]">
        {dialog.title}
      </h2>

      {dialog.message ? (
        <p className="text-body-sm font-semibold text-[var(--color-body)]">{dialog.message}</p>
      ) : null}

      {dialog.content ? <div className="w-full">{dialog.content}</div> : null}

      {dialog.badge ? (
        <Chip className={`text-xs normal-case ${isPromo ? "" : "self-start"}`}>{dialog.badge}</Chip>
      ) : null}

      <div
        className={
          isPromo
            ? "mt-1.5 flex w-full flex-col items-center gap-2"
            : "mt-1.5 flex flex-wrap items-center gap-x-[18px] gap-y-3"
        }
      >
        {dialog.actions.map((action) => {
          const isBusy = action.busy || dialog.busyActionId === action.id;
          if (action.variant === "link") {
            // A destructive confirm starts focus on its way out, so Enter never ends something.
            const autoFocus = hasDanger ? { "data-dialog-autofocus": "" } : {};
            if (action.href) {
              return (
                <a
                  key={action.id}
                  href={action.href}
                  className={LINK_ACTION}
                  {...autoFocus}
                  onClick={(e) => {
                    e.preventDefault();
                    void onAction(action.id);
                  }}
                >
                  {action.label}
                </a>
              );
            }
            return (
              <button
                key={action.id}
                type="button"
                disabled={isBusy}
                className={LINK_ACTION}
                {...autoFocus}
                onClick={() => onAction(action.id)}
              >
                {action.label}
              </button>
            );
          }

          return (
            <Button
              key={action.id}
              size={isPromo ? "md" : "sm"}
              fullWidth={isPromo}
              variant={action.variant}
              busy={isBusy}
              onClick={() => onAction(action.id)}
            >
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
