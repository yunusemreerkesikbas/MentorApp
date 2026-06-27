"use client";

import type { ReactNode } from "react";
import { ErrorLeading } from "./toast-lead";

/** Confirm dialog leading slot — same error SVG as toast (Stitch Prompt 02 variant A). */
export function getDialogErrorLeading(): ReactNode {
  return <ErrorLeading />;
}
