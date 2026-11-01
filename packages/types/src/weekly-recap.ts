import type { WeeklyReviewDto } from "./coaching.js";
import type { WeeklyReviewNarrationDto } from "./ai.js";

export type WeeklyRecapSource = "PREMIUM" | "EARNED" | "COIN";
export interface WeeklyRecapOfferDto {
  enabled: boolean;
  examId: string;
  weekStart: string;
  endDate: string;
  ready: boolean;
  premium: boolean;
  mode: WeeklyRecapSource | "OWNED" | "NONE";
  canOpen: boolean;
  premiumAvailable: boolean;
  reportId: string | null;
  cost: number;
  coinConfirmed: number;
  coinLimit: number;
  coinRemaining: number;
  windowDays: number;
  nextAvailableAt: string | null;
  reason?: string;
  message?: string;
}
export interface WeeklyRecapArchiveItemDto {
  id: string;
  examId: string;
  weekStart: string;
  endDate: string;
  locale: string;
  source: WeeklyRecapSource;
  openedAt: string;
  requiresOpening?: boolean;
}
export interface WeeklyRecapReportDto extends WeeklyRecapArchiveItemDto {
  review: WeeklyReviewDto;
  narration: WeeklyReviewNarrationDto;
}
