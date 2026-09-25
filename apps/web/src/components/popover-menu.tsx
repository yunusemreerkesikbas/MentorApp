"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  /** Used to clamp the portaled panel inside the viewport (date pickers). */
  panelWidth?: number;
  overflow?: "hidden" | "visible";
  /** `menu` for action lists; `listbox` for single-select fields; `dialog` for pickers. */
  panelRole?: "menu" | "listbox" | "dialog";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Shared floating action/select menu — PlanTaskMenu visual (radius token, soft card shadow,
 * click-away backdrop, reduced-motion aware enter). Use with `PopoverMenuItem`.
 * The panel portals to `document.body` and anchors to the trigger so overflow parents
 * (drawers, sheets) cannot clip it or send it behind a modal layer.
 */
export function PopoverMenu({
  trigger,
  children,
  align = "right",
  side = "bottom",
  matchTriggerWidth = false,
  menuClassName,
  panelWidth,
  overflow = "hidden",
  panelRole = "menu",
  open: openProp,
  onOpenChange,
}: PopoverMenuProps) {
  const reactId = useId();
  const menuId = `popover-menu-${reactId}`;
  const reduceMotion = useReducedMotion();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [measuredAnchor, setAnchor] = useState<DOMRect | null>(null);
  const open = openProp ?? uncontrolledOpen;
  const anchor = open ? measuredAnchor : null;

  function setOpen(next: boolean) {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  function close() {
    setOpen(false);
  }

  const syncAnchor = useCallback(() => {
    const node = anchorRef.current;
    if (!node) return;
    setAnchor(node.getBoundingClientRect());
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    syncAnchor();
    window.addEventListener("resize", syncAnchor);
    window.addEventListener("scroll", syncAnchor, true);
    return () => {
      window.removeEventListener("resize", syncAnchor);
      window.removeEventListener("scroll", syncAnchor, true);
    };
  }, [open, syncAnchor]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  const closedOffset = side === "top" ? 4 : -4;
  const containingDialog = anchorRef.current?.closest<HTMLDialogElement>("dialog[open]") ?? null;
  const panelStyle = panelPosition(anchor, {
    align,
    side,
    matchTriggerWidth,
    panelWidth,
    containingDialog,
  });

  const panel = (
    <AnimatePresence>
      {open && anchor ? (
        <PopoverMenuContext.Provider value={{ close }}>
          <div
            className={`${containingDialog ? "absolute" : "fixed"} inset-0 z-[90]`}
            onClick={close}
            aria-hidden
          />
          <motion.div
            key={menuId}
            id={menuId}
            role={panelRole}
            className={[
              "z-[91] rounded-[var(--radius-card)] bg-[var(--color-surface)]",
              overflow === "hidden" ? "overflow-hidden" : "overflow-visible",
              optsSideOrigin(side),
              menuClassName ?? (matchTriggerWidth ? "py-1" : "w-48 py-1"),
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              ...panelStyle,
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
  );

  return (
    <div ref={anchorRef} className="relative">
      {trigger({ open, setOpen, menuId })}
      {typeof document === "undefined"
        ? null
        : createPortal(panel, containingDialog ?? document.body)}
    </div>
  );
}

function optsSideOrigin(side: PopoverMenuSide) {
  return side === "top" ? "origin-bottom" : "origin-top";
}

function panelPosition(
  box: DOMRect | null,
  opts: {
    align: PopoverMenuAlign;
    side: PopoverMenuSide;
    matchTriggerWidth: boolean;
    panelWidth?: number;
    containingDialog: HTMLDialogElement | null;
  },
): CSSProperties {
  if (!box) return { position: "fixed" };
  const gutter = 16;
  const dialogBox = opts.containingDialog?.getBoundingClientRect();
  const originLeft = dialogBox?.left ?? 0;
  const originTop = dialogBox?.top ?? 0;
  const frameWidth = dialogBox?.width ?? window.innerWidth;
  const frameHeight = dialogBox?.height ?? window.innerHeight;
  const style: CSSProperties = { position: dialogBox ? "absolute" : "fixed" };
  if (opts.side === "top") {
    style.bottom = frameHeight - (box.top - originTop) + 4;
  } else {
    style.top = box.bottom - originTop + 4;
  }
  if (opts.matchTriggerWidth) {
    style.left = Math.max(gutter, box.left - originLeft);
    style.width = box.width;
    return style;
  }
  if (opts.panelWidth) {
    let left = (opts.align === "right" ? box.right - opts.panelWidth : box.left) - originLeft;
    left = Math.min(
      Math.max(gutter, left),
      frameWidth - opts.panelWidth - gutter,
    );
    style.left = left;
    style.width = opts.panelWidth;
    return style;
  }
  if (opts.align === "right") {
    style.right = Math.max(gutter, frameWidth - (box.right - originLeft));
  } else {
    style.left = Math.max(gutter, box.left - originLeft);
  }
  return style;
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
