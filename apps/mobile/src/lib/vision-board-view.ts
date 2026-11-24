import type { VisionBoardDoc, VisionBoardItem, VisionDto, ZoneView } from "@mentor/types";
import type { UpsertVisionInput } from "@mentor/validation";
import { seededBoard } from "@mentor/core/board-document";

export function openBoard(vision: VisionDto) {
  const subtitle = [vision.targetNames.universityName ?? vision.targetNames.titleName, vision.targetNames.cityName ?? vision.targetCity].filter(Boolean).join(" · ");
  return vision.board ?? seededBoard(vision, subtitle || null);
}

export function goalFields(vision: VisionDto | null): UpsertVisionInput {
  return {
    goalTitle: vision?.goalTitle ?? "", targetCity: vision?.targetCity ?? null,
    targetCityCode: vision?.targetCityCode ?? null, targetUniversityId: vision?.targetUniversityId ?? null,
    targetTitleId: vision?.targetTitleId ?? null, targetInstitutionId: vision?.targetInstitutionId ?? null,
    careerGroup: vision?.careerGroup ?? null, motivation: vision?.motivation ?? null,
  };
}

export function changeBoardItem(doc: VisionBoardDoc, id: string, fn: (item: VisionBoardItem) => VisionBoardItem) {
  return { ...doc, items: doc.items.map(item => item.id === id ? fn(item) : item) };
}

export function shareRooms(zones: readonly ZoneView[]) {
  return zones.filter(zone => zone.myStatus === "ACTIVE" &&
    (zone.type === "CHAT" || (zone.type === "ANNOUNCEMENT" && zone.canModerate)));
}

export function boardErrorKey(error: unknown) {
  const key = error instanceof Error ? error.message : "";
  return key === "permission" || key === "format" || key === "uploadLarge" ? key : "failure";
}
