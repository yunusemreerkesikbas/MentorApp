"use client";

import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const menuTransition = {
  type: "tween" as const,
  duration: 0.16,
  ease: [0.22, 1, 0.36, 1] as const,
};

type PopoverMenuContextValue = {
  close: () => void;
};

const PopoverMenuContext = createContext<PopoverMenuContextValue | null>(null);

export type PopoverMenuAlign = "left" | "right";
export type PopoverMenuSide = "top" | "bottom";

export interface PopoverMenuProps {
  /**
   * Render prop for the control that opens the menu. Receives open state helpers so
   * callers can wire `aria-expanded` / `aria-controls` without owning the panel markup.
   */
  trigger: (args: {
    open: boolean;
    setOpen: (open: boolean) => void;
    menuId: string;
  }) => ReactNode;
  children: ReactNode;
  align?: PopoverMenuAlign;
  /** Opens above the trigger when space below is constrained (for example sheet footers). */
  side?: PopoverMenuSide;
  /** Stretch the panel to the trigger's width (form selects). */
  matchTriggerWidth?: boolean;
  /** Extra classes on the floating panel (e.g. `w-48`, `min-w-[14rem]`). */
  menuClassName?: string;
  /** `menu` for action lists; `listbox` for single-select fields. */
  panelRole?: "menu" | "listbox";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Shared floating action/select menu — PlanTaskMenu visual (radius token, soft card shadow,
 * click-away backdrop, reduced-motion aware enter). Use with `PopoverMenuItem`.
 */
export function PopoverMenu({
  trigger,
  children,
  align = "right",
  side = "bottom",
  matchTriggerWidth = false,
  menuClassName,
  panelRole = "menu",
  open: openProp,
  onOpenChange,
}: PopoverMenuProps) {
  const reactId = useId();
  const menuId = `popover-menu-${reactId}`;
  const reduceMotion = useReducedMotion();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  function close() {
    setOpen(false);
  }

  const widthClass = matchTriggerWidth
    ? "left-0 right-0 w-full"
    : align === "left"
      ? "left-0"
      : "right-0";
  const sideClass = side === "top" ? "bottom-full mb-1 origin-bottom" : "mt-1 origin-top";
  const closedOffset = side === "top" ? 4 : -4;

  return (
    <div className="relative">
      {trigger({ open, setOpen, menuId })}

      {open ? (
        <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
      ) : null}

      <AnimatePresence>
        {open ? (
          <PopoverMenuContext.Provider value={{ close }}>
            <motion.div
              key={menuId}
              id={menuId}
              role={panelRole}
              className={[
                "absolute z-50 overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] py-1",
                widthClass,
                sideClass,
                menuClassName ?? (matchTriggerWidth ? "" : "w-48"),
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                border:
                  "1px solid color-mix(in srgb, var(--color-main) 8%, transparent)",
                boxShadow: "var(--shadow-card)",
              }}
              initial={
                reduceMotion ? false : { opacity: 0, scaleY: 0.85, y: closedOffset }
              }
              animate={{ opacity: 1, scaleY: 1, y: 0 }}
              exit={
                reduceMotion ? undefined : { opacity: 0, scaleY: 0.9, y: closedOffset }
              }
              transition={reduceMotion ? { duration: 0 } : menuTransition}
            >
              {children}
            </motion.div>
          </PopoverMenuContext.Provider>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export interface PopoverMenuItemProps {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Highlights the current value in listbox / select usage. */
  selected?: boolean;
  role?: "menuitem" | "option";
  /**
   * When false, the panel stays open after click (nested flows like report → reason).
   * Default true — action menus and selects dismiss on choose.
   */
  closeOnClick?: boolean;
  className?: string;
}

export function PopoverMenuItem({
  children,
  onClick,
  danger,
  disabled,
  selected,
  role = "menuitem",
  closeOnClick = true,
  className,
}: PopoverMenuItemProps) {
  const ctx = useContext(PopoverMenuContext);

  return (
    <button
      type="button"
      role={role}
      aria-selected={role === "option" ? Boolean(selected) : undefined}
      disabled={disabled}
      onClick={() => {
        onClick();
        if (closeOnClick) ctx?.close();
      }}
      className={[
        "block w-full cursor-pointer px-3 py-2.5 text-left text-sm font-semibold transition-colors",
        "hover:bg-[color-mix(in_srgb,var(--color-main)_8%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--color-main)_8%,transparent)] focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        selected ? "bg-[color-mix(in_srgb,var(--color-main)_12%,transparent)]" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        color: danger ? "var(--color-danger)" : "var(--color-main)",
      }}
    >
      {children}
    </button>
  );
}
