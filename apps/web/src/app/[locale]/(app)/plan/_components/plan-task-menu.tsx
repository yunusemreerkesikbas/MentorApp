"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import EllipsisVertical from "lucide-react/dist/esm/icons/ellipsis-vertical.mjs";
import { useTranslations } from "next-intl";

const menuTransition = {
  type: "tween" as const,
  duration: 0.16,
  ease: [0.22, 1, 0.36, 1] as const,
};

/** Compact ⋯ dropdown for plan tasks (ThreadMenu pattern — no bottom sheet). */
export function PlanTaskMenu({
  taskTitle,
  disabled,
  onEdit,
  onDelete,
}: {
  taskTitle: string;
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("plan");
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t("task_menu_aria", { title: taskTitle })}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={{ color: "var(--color-secondary)" }}
      >
        <EllipsisVertical size={20} strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
      ) : null}

      <AnimatePresence>
        {open ? (
          <motion.div
            key="plan-task-menu"
            role="menu"
            className="absolute right-0 z-50 mt-1 origin-top w-48 overflow-hidden rounded-[var(--radius-card)] bg-white py-1"
            style={{
              border:
                "1px solid color-mix(in srgb, var(--color-main) 8%, transparent)",
              boxShadow: "var(--shadow-card)",
            }}
            initial={
              reduceMotion ? false : { opacity: 0, scaleY: 0.85, y: -4 }
            }
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={
              reduceMotion ? undefined : { opacity: 0, scaleY: 0.9, y: -4 }
            }
            transition={reduceMotion ? { duration: 0 } : menuTransition}
          >
            <MenuItem
              onClick={() => {
                close();
                onEdit();
              }}
            >
              {t("task_action_edit")}
            </MenuItem>
            <MenuItem
              danger
              onClick={() => {
                close();
                onDelete();
              }}
            >
              {t("task_action_delete")}
            </MenuItem>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full cursor-pointer px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04] focus-visible:outline-none motion-reduce:transition-none"
      style={{ color: danger ? "var(--color-danger)" : "var(--color-main)" }}
    >
      {children}
    </button>
  );
}
