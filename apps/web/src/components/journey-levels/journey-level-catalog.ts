import {
  JourneyLevelChapterId,
  JourneyLevelKey,
  type JourneyLevelChapterId as JourneyLevelChapterIdType,
  type JourneyLevelKey as JourneyLevelKeyType,
} from "@mentor/types";

export interface JourneyLevelCatalogItem {
  tier: number;
  key: JourneyLevelKeyType;
  chapter: JourneyLevelChapterIdType;
}

export const JOURNEY_LEVEL_CATALOG: readonly JourneyLevelCatalogItem[] = [
  { tier: 1, key: JourneyLevelKey.SPARK, chapter: JourneyLevelChapterId.AWAKENING },
  { tier: 2, key: JourneyLevelKey.TRAIL, chapter: JourneyLevelChapterId.AWAKENING },
  { tier: 3, key: JourneyLevelKey.COMPASS, chapter: JourneyLevelChapterId.AWAKENING },
  { tier: 4, key: JourneyLevelKey.CYCLE, chapter: JourneyLevelChapterId.HARMONY },
  { tier: 5, key: JourneyLevelKey.RHYTHM, chapter: JourneyLevelChapterId.HARMONY },
  { tier: 6, key: JourneyLevelKey.FLOW, chapter: JourneyLevelChapterId.HARMONY },
  { tier: 7, key: JourneyLevelKey.ROOT, chapter: JourneyLevelChapterId.DEEPENING },
  { tier: 8, key: JourneyLevelKey.WING, chapter: JourneyLevelChapterId.DEEPENING },
  { tier: 9, key: JourneyLevelKey.HORIZON, chapter: JourneyLevelChapterId.DEEPENING },
  { tier: 10, key: JourneyLevelKey.LANTERN, chapter: JourneyLevelChapterId.SHARED_LIGHT },
  { tier: 11, key: JourneyLevelKey.STAR, chapter: JourneyLevelChapterId.SHARED_LIGHT },
  { tier: 12, key: JourneyLevelKey.CONSTELLATION, chapter: JourneyLevelChapterId.SHARED_LIGHT },
] as const;

export const JOURNEY_LEVEL_CHAPTERS = [
  { id: JourneyLevelChapterId.AWAKENING, number: 1 },
  { id: JourneyLevelChapterId.HARMONY, number: 2 },
  { id: JourneyLevelChapterId.DEEPENING, number: 3 },
  { id: JourneyLevelChapterId.SHARED_LIGHT, number: 4 },
] as const;

export function getJourneyLevelCatalogItem(key: JourneyLevelKeyType) {
  return JOURNEY_LEVEL_CATALOG.find((item) => item.key === key);
}

