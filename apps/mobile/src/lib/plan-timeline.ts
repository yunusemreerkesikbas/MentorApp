/** The Plan tab's views on the phone. */
export type PlanViewMode = "list" | "timeline" | "calendar";

/** Restore the saved view, defaulting to Liste. */
export function readPlanViewMode(raw: string | null): PlanViewMode {
  return raw === "timeline" || raw === "calendar" ? raw : "list";
}

/** Where the rail's lines and markers are centred, from the scroller's content edge (web 22px). */
export const TIMELINE_RAIL_X = 22;
/** What the end spacer leaves of the scroller, so the last day's header still reaches the top. */
export const TIMELINE_END_RESERVE = 72;

/** The day Timeline opens on: today when the week holds it, otherwise the selected day. */
export function timelinePinTarget(days: readonly string[], today: string, selected: string): string {
  return days.includes(today) ? today : selected;
}

export interface TimelineDayTop {
  iso: string;
  top: number;
}

/** The web's `syncFromScroll`: the day whose top is nearest the scroll offset; the earlier wins a tie. */
export function activeTimelineDay(tops: readonly TimelineDayTop[], scrollTop: number): string | null {
  let active: string | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const { iso, top } of tops) {
    const distance = Math.abs(top - scrollTop);
    if (distance < best) {
      best = distance;
      active = iso;
    }
  }
  return active;
}

/** Pending tasks first, then done ones, each group in the order the API sent. */
export function orderTimelineTasks<T extends { status: string }>(tasks: readonly T[]): T[] {
  return [...tasks.filter((task) => task.status !== "DONE"), ...tasks.filter((task) => task.status === "DONE")];
}

/** How much of the rail is filled: down to the active day's marker, within 0..1. */
export function railFillRatio(activeTop: number, railHeight: number): number {
  if (railHeight <= 0) return 1;
  return Math.min(1, Math.max(0, (activeTop + TIMELINE_RAIL_X) / railHeight));
}

/**
 * Where a fling may come to rest: each day's top, plus stops inside a day taller than the
 * scroller. The web's CSS snap lets an oversized day scroll freely; `snapToOffsets` would skip
 * its lower rows, so they get stops half a screen apart and one at its bottom: any row up to half
 * the scroller tall then rests whole at some stop.
 */
export function timelineSnapOffsets(
  dayTops: readonly number[],
  dayHeights: readonly number[],
  viewport: number,
): number[] {
  const stops: number[] = [];
  dayTops.forEach((top, index) => {
    stops.push(top);
    const height = dayHeights[index] ?? 0;
    if (viewport <= 0 || height <= viewport) return;
    const last = top + height - viewport;
    const stride = Math.max(1, viewport / 2);
    for (let stop = top + stride; stop < last; stop += stride) stops.push(stop);
    stops.push(last);
  });
  return [...new Set(stops)].sort((a, b) => a - b);
}

/**
 * Wait until the range's tasks are in and every day is
 * measured, pin the range once, then scroll to each day picked outside its own scrolling (strip,
 * dot, date sheet, a saved task). `request` counts those picks; `handled` is the last one acted on,
 * so a day the scroller reached on its own never scrolls it, however late its render lands.
 */
export function scrollSync(state: {
  range: string;
  pinnedRange: string | null;
  loading: boolean;
  measured: boolean;
  request: number;
  handled: number;
}): "wait" | "pin" | "scroll" | "none" {
  if (state.pinnedRange !== state.range) return state.loading || !state.measured ? "wait" : "pin";
  return state.request === state.handled ? "none" : "scroll";
}

/**
 * Space after the last day so it can rest at the scroller's top but not scroll past it (RN
 * treats the content's end as a snap stop). The web's reserve stands in until it is measured.
 * Pass the scroller's set height, not a measured one: the reserve must already be laid out when
 * the pin scrolls, since Fabric runs that `scrollTo` before a taller content lands and clamps it.
 */
export function timelineEndSpace(viewport: number, lastDayHeight: number | undefined, padding: number): number {
  if (lastDayHeight === undefined) return Math.max(0, viewport - TIMELINE_END_RESERVE);
  return Math.max(0, viewport - lastDayHeight - padding);
}
