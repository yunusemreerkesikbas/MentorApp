"use client";

import { forwardRef } from "react";
import {
  DatePickerSheet,
  type DatePickerSheetHandle,
} from "@/components/date-picker-sheet";

export type AnalysisDatePickerSheetHandle = DatePickerSheetHandle;

export type AnalysisDatePickerSheetProps = {
  defaultValue: string;
};

/** Analysis date sheet — shared DatePickerSheet body. */
export const AnalysisDatePickerSheet = forwardRef<
  AnalysisDatePickerSheetHandle,
  AnalysisDatePickerSheetProps
>(function AnalysisDatePickerSheet({ defaultValue }, ref) {
  return <DatePickerSheet ref={ref} defaultValue={defaultValue} />;
});
