"use client";

import { useId } from "react";
import { Button } from "../button.js";
import { Chip } from "../chip.js";
import type { DialogRecord } from "./types.js";

export interface DialogPanelProps {
  dialog: DialogRecord;
  onAction: (actionId: string) => void;
}

/**
 * Dialog card (Stitch Prompt 02): translucent surface, standard or promo layout.
 */
export function DialogPanel({ dialog, onAction }: DialogPanelProps) {
  const titleId = useId();
  const isPromo = dialog.layout === "promo";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-mentor-dialog-panel
      className={`relative w-full max-w-[335px] border border-white bg-white/92 p-6 shadow-[var(--shadow-card)] backdrop-blur-md lg:max-w-[480px] ${isPromo ? "flex flex-col items-center text-center" : "flex flex-col"} ${dialog.exiting ? "opacity-0 motion-reduce:opacity-0" : "animate-dialog-enter motion-reduce:animate-none"} rounded-[var(--radius-card)] motion-reduce:transition-none transition-opacity duration-200`}
      onClick={(e) => e.stopPropagation()}
    >
      {dialog.hero ? (
        <div className="mb-4 h-[72px] w-[72px] shrink-0">{dialog.hero}</div>
      ) : null}

      {dialog.leading && !isPromo ? (
        <div className="mb-2 flex items-center gap-3">
          <div className="shrink-0">{dialog.leading}</div>
          <h2
            id={titleId}
            className="text-lg font-semibold leading-snug"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {dialog.title}
          </h2>
        </div>
      ) : (
        <h2
          id={titleId}
          className={`text-lg font-semibold leading-snug ${isPromo ? "mb-1" : "mb-2"}`}
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {dialog.title}
        </h2>
      )}

      {dialog.message ? (
        <p
          className={`text-base leading-normal ${isPromo ? "mb-4 px-2" : "mb-6"}`}
          style={{
            color: "var(--color-body)",
            fontFamily: "var(--font-body)",
          }}
        >
          {dialog.message}
        </p>
      ) : dialog.content ? null : (
        <div className={isPromo ? "mb-4" : "mb-6"} />
      )}

      {dialog.content ? <div className={isPromo ? "mb-4 w-full" : "mb-6 w-full"}>{dialog.content}</div> : null}

      {dialog.badge ? (
        <Chip className={`mb-6 text-xs normal-case ${isPromo ? "" : "self-start"}`}>
          {dialog.badge}
        </Chip>
      ) : null}

      <div className="flex w-full flex-col gap-3">
        {dialog.actions.map((action) => {
          const isBusy = action.busy || dialog.busyActionId === action.id;
          if (action.variant === "link") {
            if (action.href) {
              return (
                <a
                  key={action.id}
                  href={action.href}
                  className="text-sm underline-offset-4 hover:underline"
                  style={{
                    color: "var(--color-main)",
                    fontFamily: "var(--font-body)",
                  }}
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
                className="cursor-pointer text-sm underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  color: "var(--color-main)",
                  fontFamily: "var(--font-body)",
                }}
                onClick={() => onAction(action.id)}
              >
                {action.label}
              </button>
            );
          }

          return (
            <Button
              key={action.id}
              fullWidth
              variant={action.variant === "secondary" ? "secondary" : "primary"}
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
