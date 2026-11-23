import { groupPlanTasksByDate, shiftDate } from "@mentor/core";
import type {
  EconomyBalance,
  EconomyUsesView,
  InviteCodeView,
  InvitePreviewView,
  MoodCheckinDto,
  NotebookSlotView,
  Paginated,
  PlanEventDto,
  PlanTaskCalendarDto,
  PlanTaskDto,
  QuestProgressView,
  RedeemInviteResult,
  StreakRescueView,
  StudySessionDto,
  TodayPanelResponse,
  VisionDto,
  WeeklyChestView,
  WeeklyRecapArchiveItemDto,
  WeeklyRecapOfferDto,
  WeeklyRecapReportDto,
  WeeklyReportFollowUpDto,
  WeeklyReviewCompletionDto,
  WeeklyReviewDto,
} from "@mentor/types";
import type {
  CreateMoodCheckinInput,
  CreatePlanTaskInput,
  CreateWeeklyReportTaskInput,
  OpenWeeklyRecapInput,
  SessionFeedbackInput,
  StartStudySessionInput,
  UpdatePlanTaskInput,
  UpdateStudySessionInput,
  UpsertVisionInput,
} from "@mentor/validation";
import {
  coachingControllerGetToday,
  coachingControllerUpsertMood,
  economyControllerQuestsList,
  getPlanEventControllerListEventsUrl,
  getPlanTaskControllerListUrl,
  getStudySessionControllerListUrl,
  http,
  planTaskControllerCreate,
  planTaskControllerRemove,
  planTaskControllerUpdate,
  studySessionControllerFinalize,
  studySessionControllerRecordFeedback,
  studySessionControllerStart,
  weeklyRecapControllerArchive,
  weeklyRecapControllerCreateTask,
  weeklyRecapControllerTracking,
} from "@mentor/api-client";

const MAX_PAGE_SIZE = 100;

/**
 * Typed coaching & economy API adapters for `apps/mobile`.
 * Mirrors the single-place DTO unwrapping pattern in `apps/web/src/lib/{plan-tasks,study-sessions,economy}.ts`
 * so mobile screens and components remain 100% cast-free.
 */

export async function fetchTodayPanel(): Promise<TodayPanelResponse> {
  const res = await coachingControllerGetToday();
  return ((res as { data?: TodayPanelResponse }).data ?? res) as TodayPanelResponse;
}

export async function upsertMoodCheckin(
  input: CreateMoodCheckinInput,
): Promise<MoodCheckinDto> {
  const res = await coachingControllerUpsertMood(input);
  return ((res as { data?: MoodCheckinDto }).data ?? res) as MoodCheckinDto;
}

export async function fetchEconomyBalance(): Promise<EconomyBalance | null> {
  try {
    return (await http<EconomyBalance>("/v1/economy/balance")) as EconomyBalance;
  } catch {
    return null;
  }
}

export async function fetchDailyQuests(): Promise<QuestProgressView[]> {
  try {
    return await economyControllerQuestsList();
  } catch {
    return [];
  }
}

export async function fetchStreakRescue(): Promise<StreakRescueView | null> {
  try {
    return (await http<StreakRescueView>("/v1/economy/streak-rescue")) as StreakRescueView;
  } catch {
    return null;
  }
}

export async function purchaseStreakRescue(): Promise<StreakRescueView> {
  return (await http<StreakRescueView>("/v1/economy/streak-rescue", {
    method: "POST",
  })) as StreakRescueView;
}

export async function listPlanTasksForRange(
  from: string,
  to: string,
): Promise<PlanTaskDto[]> {
  const pageUrl = (page: number) =>
    `${getPlanTaskControllerListUrl()}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&pageSize=${MAX_PAGE_SIZE}`;

  const first = (await http<Paginated<PlanTaskDto>>(pageUrl(1))) as Paginated<PlanTaskDto>;
  const pageCount = Math.ceil(first.total / MAX_PAGE_SIZE);
  if (pageCount <= 1) return first.items;

  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) =>
      http<Paginated<PlanTaskDto>>(pageUrl(i + 2)) as Promise<Paginated<PlanTaskDto>>,
    ),
  );
  return [...first.items, ...rest.flatMap((page) => page.items)];
}

/** Days in an inclusive range that hold at least one task (the date sheet's dots). */
export async function listPlanTaskCalendarDates(from: string, to: string): Promise<string[]> {
  const url = `${getPlanTaskControllerListUrl()}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return ((await http<PlanTaskCalendarDto>(url)) as PlanTaskCalendarDto).dates;
}

/**
 * The events a student takes part in over an inclusive range: meetings their coach set up with
 * them. Same paging as the web's `lib/plan-events.ts`.
 */
export async function listPlanEventsForRange(from: string, to: string): Promise<PlanEventDto[]> {
  const pageUrl = (page: number) =>
    `${getPlanEventControllerListEventsUrl()}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&pageSize=${MAX_PAGE_SIZE}`;
  const first = (await http<Paginated<PlanEventDto>>(pageUrl(1))) as Paginated<PlanEventDto>;
  const pageCount = Math.ceil(first.total / MAX_PAGE_SIZE);
  if (pageCount <= 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) =>
      http<Paginated<PlanEventDto>>(pageUrl(i + 2)) as Promise<Paginated<PlanEventDto>>,
    ),
  );
  return [...first.items, ...rest.flatMap((page) => page.items)];
}

export async function listPlanTasksForWeek(
  weekStartDate: string,
): Promise<Record<string, PlanTaskDto[]>> {
  const weekEnd = shiftDate(weekStartDate, 6);
  const grouped = groupPlanTasksByDate(
    await listPlanTasksForRange(weekStartDate, weekEnd),
  );
  for (let i = 0; i < 7; i++) {
    const iso = shiftDate(weekStartDate, i);
    if (!grouped[iso]) grouped[iso] = [];
  }
  return grouped;
}

export async function createPlanTask(
  input: CreatePlanTaskInput,
): Promise<PlanTaskDto> {
  return (await planTaskControllerCreate(input)) as unknown as PlanTaskDto;
}

export async function updatePlanTask(
  id: string,
  input: UpdatePlanTaskInput,
): Promise<PlanTaskDto> {
  return (await planTaskControllerUpdate(id, input)) as unknown as PlanTaskDto;
}

export async function deletePlanTask(id: string): Promise<void> {
  await planTaskControllerRemove(id);
}

export async function startStudySession(
  input: StartStudySessionInput,
): Promise<StudySessionDto> {
  return (await studySessionControllerStart(
    input as Parameters<typeof studySessionControllerStart>[0],
  )) as unknown as StudySessionDto;
}

export async function finalizeStudySession(
  id: string,
  input: UpdateStudySessionInput,
): Promise<StudySessionDto> {
  return (await studySessionControllerFinalize(
    id,
    input as Parameters<typeof studySessionControllerFinalize>[1],
  )) as unknown as StudySessionDto;
}

export async function recordSessionFeedback(
  id: string,
  input: SessionFeedbackInput,
): Promise<void> {
  await studySessionControllerRecordFeedback(
    id,
    input as Parameters<typeof studySessionControllerRecordFeedback>[1],
  );
}

export async function listRecentStudySessions(
  pageSize = 5,
): Promise<StudySessionDto[]> {
  const url = `${getStudySessionControllerListUrl()}?page=1&pageSize=${pageSize}`;
  const res = (await http<Paginated<StudySessionDto>>(url)) as Paginated<StudySessionDto>;
  return res.items;
}

export async function fetchWeeklyChest(): Promise<WeeklyChestView | null> {
  try {
    return (await http<WeeklyChestView>("/v1/economy/weekly-chest")) as WeeklyChestView;
  } catch {
    return null;
  }
}

export async function openWeeklyChest(
  periodKey: string,
): Promise<WeeklyChestView> {
  return (await http<WeeklyChestView>("/v1/economy/weekly-chest/open", {
    method: "POST",
    body: JSON.stringify({ periodKey }),
  })) as WeeklyChestView;
}

export async function fetchVision(): Promise<VisionDto | null> {
  return (await http<VisionDto | null>("/v1/coaching/vision")) ?? null;
}

export async function upsertVision(
  input: UpsertVisionInput,
): Promise<VisionDto> {
  return (await http<VisionDto>("/v1/coaching/vision", {
    method: "POST",
    body: JSON.stringify(input),
  })) as VisionDto;
}

export async function fetchInviteCard(): Promise<InviteCodeView | null> {
  try {
    return (await http<InviteCodeView>("/v1/economy/invite")) as InviteCodeView;
  } catch {
    return null;
  }
}

export async function previewFriendInvite(
  code: string,
): Promise<InvitePreviewView> {
  return (await http<InvitePreviewView>(
    `/v1/economy/invite/preview/${encodeURIComponent(code)}`,
  )) as InvitePreviewView;
}

export async function redeemFriendInvite(
  code: string,
): Promise<RedeemInviteResult> {
  return (await http<RedeemInviteResult>("/v1/economy/invite/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  })) as RedeemInviteResult;
}

export async function fetchEconomyUses(): Promise<EconomyUsesView | null> {
  try {
    return (await http<EconomyUsesView>("/v1/economy/uses")) as EconomyUsesView;
  } catch {
    return null;
  }
}

export async function fetchNotebookSlotQuote(): Promise<NotebookSlotView | null> {
  try {
    return (await http<NotebookSlotView>(
      "/v1/economy/notebook-slots",
    )) as NotebookSlotView;
  } catch {
    return null;
  }
}

export async function purchaseNotebookSlot(input: {
  expectedCost: number;
  expectedPurchasedSlots: number;
  idempotencyKey: string;
}): Promise<NotebookSlotView> {
  return (await http<NotebookSlotView>("/v1/economy/notebook-slots", {
    method: "POST",
    headers: {
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      expectedCost: input.expectedCost,
      expectedPurchasedSlots: input.expectedPurchasedSlots,
    }),
  })) as NotebookSlotView;
}

/* ------------------------------ weekly recap ------------------------------ */

/** Last completed week's review; the free path when recap access is off (`offer.enabled` false). */
export async function fetchWeeklyReview(examId: string): Promise<WeeklyReviewDto> {
  return (await http<WeeklyReviewDto>(
    `/v1/coaching/weekly-review?examId=${encodeURIComponent(examId)}`,
  )) as WeeklyReviewDto;
}

/** The story was watched to its end; feeds quests and rewards (one per week on the server). */
export async function completeWeeklyReview(
  examId: string,
  weekStart: string,
): Promise<WeeklyReviewCompletionDto> {
  return (await http<WeeklyReviewCompletionDto>("/v1/coaching/weekly-review/completion", {
    method: "PUT",
    body: JSON.stringify({ examId, weekStart }),
  })) as WeeklyReviewCompletionDto;
}

export async function fetchWeeklyRecapOffer(
  examId: string,
  weekStart?: string,
): Promise<WeeklyRecapOfferDto> {
  const query = new URLSearchParams({ examId, ...(weekStart ? { weekStart } : {}) });
  return (await http<WeeklyRecapOfferDto>(
    `/v1/coach/weekly-recaps/access?${query.toString()}`,
  )) as WeeklyRecapOfferDto;
}

export async function openWeeklyRecap(input: OpenWeeklyRecapInput): Promise<WeeklyRecapReportDto> {
  return (await http<WeeklyRecapReportDto>("/v1/coach/weekly-recaps", {
    method: "POST",
    headers: { "Idempotency-Key": input.clientRequestId },
    body: JSON.stringify(input),
  })) as WeeklyRecapReportDto;
}

export async function fetchWeeklyRecapArchive(page: number): Promise<Paginated<WeeklyRecapArchiveItemDto>> {
  return await weeklyRecapControllerArchive({ page, pageSize: 10 }) as Paginated<WeeklyRecapArchiveItemDto>;
}

export async function fetchOwnedWeeklyRecap(id: string): Promise<WeeklyRecapReportDto> {
  return (await http<WeeklyRecapReportDto>(
    `/v1/coach/weekly-recaps/${encodeURIComponent(id)}`,
  )) as WeeklyRecapReportDto;
}

export async function fetchWeeklyReportFollowUp(id: string): Promise<WeeklyReportFollowUpDto> {
  return await weeklyRecapControllerTracking(id) as unknown as WeeklyReportFollowUpDto;
}

export async function createWeeklyReportTask(id: string, input: CreateWeeklyReportTaskInput): Promise<PlanTaskDto> {
  return await weeklyRecapControllerCreateTask(id, input) as unknown as PlanTaskDto;
}
