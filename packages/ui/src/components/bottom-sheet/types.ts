import type { ReactNode } from "react";

export type BottomSheetLayout = "action" | "filter";

export type BottomSheetActionIcon =
  | "check-circle"
  | "clock"
  | "refresh"
  | "delete";

export interface BottomSheetAction {
  id: string;
  label: string;
  icon?: BottomSheetActionIcon;
  destructive?: boolean;
  /** Defaults to true for non-destructive rows. */
  showChevron?: boolean;
}

export interface BottomSheetShowOptions {
  title: string;
  layout?: BottomSheetLayout;
  actions?: BottomSheetAction[];
  cancelLabel?: string;
  applyLabel?: string;
  closeLabel: string;
  children?: ReactNode;
  dismissOnBackdrop?: boolean;
  dismissOnEscape?: boolean;
  onApply?: () => void | Promise<void>;
}

export interface BottomSheetActionSheetOptions {
  title: string;
  actions: BottomSheetAction[];
  cancelLabel: string;
  closeLabel: string;
}

export interface BottomSheetFilterOptions {
  title: string;
  applyLabel: string;
  closeLabel: string;
  children: ReactNode;
  onApply?: () => void | Promise<void>;
}

export interface BottomSheetRecord extends BottomSheetShowOptions {
  id: string;
  layout: BottomSheetLayout;
  exiting?: boolean;
  busyApply?: boolean;
}

export type BottomSheetActionResult = string | "cancel";

export interface BottomSheetContextValue {
  sheet: BottomSheetRecord | null;
  show: (options: BottomSheetShowOptions) => void;
  dismiss: () => void;
  actionSheet: (
    options: BottomSheetActionSheetOptions,
  ) => Promise<BottomSheetActionResult>;
  filterSheet: (
    options: BottomSheetFilterOptions,
  ) => Promise<"apply" | "cancel">;
}

export const BOTTOM_SHEET_EXIT_MS = 240;
