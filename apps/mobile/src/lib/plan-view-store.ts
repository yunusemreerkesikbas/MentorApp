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
