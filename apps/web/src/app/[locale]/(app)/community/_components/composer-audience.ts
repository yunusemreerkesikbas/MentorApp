import type { ZoneView } from "@mentor/types";

export type ComposerAudienceMode = "share" | "question";

export function eligibleComposerZones(
  zones: ZoneView[],
  mode: ComposerAudienceMode,
): ZoneView[] {
  return zones.filter((zone) => {
    if (zone.myStatus !== "ACTIVE") return false;
    if (mode === "question") return zone.type === "QA";
    return zone.type === "CHAT" || (zone.type === "ANNOUNCEMENT" && zone.canModerate);
  });
}
