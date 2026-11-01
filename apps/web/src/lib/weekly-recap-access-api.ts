import {
  weeklyRecapControllerOffer, weeklyRecapControllerOpen,
  weeklyRecapControllerArchive, weeklyRecapControllerRead,
} from "@mentor/api-client";
import type { Paginated, WeeklyRecapArchiveItemDto, WeeklyRecapOfferDto, WeeklyRecapReportDto } from "@mentor/types";
import type { OpenWeeklyRecapInput } from "@mentor/validation";

export async function fetchWeeklyRecapOffer(examId: string, weekStart?: string) {
  return await weeklyRecapControllerOffer({ examId, weekStart }) as WeeklyRecapOfferDto;
}
export async function openWeeklyRecap(body: OpenWeeklyRecapInput) {
  return await weeklyRecapControllerOpen(body, { headers: { "Idempotency-Key": body.clientRequestId } }) as unknown as WeeklyRecapReportDto;
}
export async function fetchWeeklyRecapArchive(page = 1) {
  return await weeklyRecapControllerArchive({ page, pageSize: 10 }) as Paginated<WeeklyRecapArchiveItemDto>;
}
export async function fetchOwnedWeeklyRecap(id: string) {
  return await weeklyRecapControllerRead(id) as unknown as WeeklyRecapReportDto;
}
