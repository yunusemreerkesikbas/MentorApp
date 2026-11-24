import { readPlanCalendarScale, type PlanCalendarScale } from "./plan-calendar.js";
import * as SecureStore from "expo-secure-store";
import { readPlanViewMode, type PlanViewMode } from "./plan-timeline.js";

// The web's localStorage `mentor.plan.view`. ponytail: one short string in SecureStore, the only
// key-value store installed; its sync API lets the first frame open on the saved view.
const KEY = "mentor.plan.view.v1";

export function loadPlanViewMode(): PlanViewMode {
  try {
    return readPlanViewMode(SecureStore.getItem(KEY));
  } catch {
    return "list";
  }
}

export function savePlanViewMode(mode: PlanViewMode): void {
  try {
    SecureStore.setItem(KEY, mode);
  } catch {
    // A lost write only reopens Liste next time.
  }
}

const CALENDAR_SCALE_KEY = "mentor.plan.calendar-scale.v1";

export function loadPlanCalendarScale(): PlanCalendarScale {
  try {
    return readPlanCalendarScale(SecureStore.getItem(CALENDAR_SCALE_KEY));
  } catch {
    return "week";
  }
}

export function savePlanCalendarScale(scale: PlanCalendarScale): void {
  try {
    SecureStore.setItem(CALENDAR_SCALE_KEY, scale);
  } catch {
    // The default is safe if the device cannot save the preference.
  }
}
