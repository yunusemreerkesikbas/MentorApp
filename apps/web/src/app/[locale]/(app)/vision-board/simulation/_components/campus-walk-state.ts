export type CampusWalkPhase = "IDLE" | "ARRIVING" | "WALKING";

export type CampusWalkState = {
  poiId: string | null;
  phase: CampusWalkPhase;
};

export type CampusWalkEvent =
  | { type: "POI_CHANGED"; poiId: string }
  | { type: "PANORAMA_READY"; poiId: string }
  | { type: "PANORAMA_MOVED"; poiId: string }
  | { type: "MOTION_SETTLED"; poiId: string }
  | { type: "RESET" };

export const initialCampusWalkState: CampusWalkState = {
  poiId: null,
  phase: "IDLE",
};

export function reduceCampusWalkState(
  state: CampusWalkState,
  event: CampusWalkEvent,
): CampusWalkState {
  if (event.type === "RESET") return initialCampusWalkState;
  if (event.type === "POI_CHANGED") {
    return { poiId: event.poiId, phase: "IDLE" };
  }
  if (state.poiId !== event.poiId) return state;

  switch (event.type) {
    case "PANORAMA_READY":
      return { ...state, phase: "ARRIVING" };
    case "PANORAMA_MOVED":
      return { ...state, phase: "WALKING" };
    case "MOTION_SETTLED":
      return { ...state, phase: "IDLE" };
  }
}
