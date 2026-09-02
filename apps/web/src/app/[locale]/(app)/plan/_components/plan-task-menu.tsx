"use client";
import { EllipsisVertical } from "lucide-react";

import { useTranslations } from "next-intl";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";

/** Compact ⋯ dropdown for plan tasks (shared PopoverMenu — no bottom sheet). */
export function PlanTaskMenu({
  taskTitle,
  disabled,
  editable = true,
  onEdit,
  onDelete,
}: {
  taskTitle: string;
  disabled?: boolean;
  /** False for a coach-assigned task: the API refuses the edit, so offering it would only lie. */
  editable?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("plan");

  return (
    <PopoverMenu
      align="right"
      menuClassName="w-48"
      trigger={({ open, setOpen, menuId }) => (
        <button
          type="button"
          aria-label={t("task_menu_aria", { title: taskTitle })}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{ color: "var(--color-secondary)" }}
        >
          <EllipsisVertical size={20} strokeWidth={2} aria-hidden />
        </button>
      )}
    >
      {editable ? (
        <PopoverMenuItem onClick={onEdit}>{t("task_action_edit")}</PopoverMenuItem>
      ) : null}
      <PopoverMenuItem danger onClick={onDelete}>
        {t("task_action_delete")}
      </PopoverMenuItem>
    </PopoverMenu>
  );
}
