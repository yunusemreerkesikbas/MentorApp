import type {
  MentorshipWeeklyEvidenceKind,
  MentorshipWeeklyReportDto,
  MentorshipWeeklyReportListItemDto,
  MentorshipWeeklyReportPreviewDto,
  MentorshipWeeklyReportShareDto,
  Paginated,
} from "@mentor/types";
import {
  mentorshipWeeklyReportControllerFinalize,
  mentorshipWeeklyReportControllerGenerateBrief,
  mentorshipWeeklyReportControllerGet,
  mentorshipWeeklyReportControllerList,
  mentorshipWeeklyReportControllerPreview,
  mentorshipWeeklyReportControllerReadBrief,
  mentorshipWeeklyReportControllerShare,
} from "@mentor/api-client";

const DAY_MS = 86_400_000;

export function shiftWeekStart(startDate: string, weeks: number): string {
  return new Date(Date.parse(`${startDate}T00:00:00.000Z`) + weeks * 7 * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function formatWeeklyMetric(
  kind: MentorshipWeeklyEvidenceKind,
  value: number | null,
  locale: string,
): string {
  if (value === null) return locale === "tr" ? "Yok" : "None";
  if (kind === "COMPLETION_RATE")
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value);
  if (kind === "FOCUS_MINUTES")
    return `${Math.round(value)} ${locale === "tr" ? "dk" : "min"}`;
  return new Intl.NumberFormat(locale).format(value);
}

export async function fetchWeeklyReportPreview(
  studentId: string,
  weekStart?: string,
): Promise<MentorshipWeeklyReportPreviewDto> {
  return (await mentorshipWeeklyReportControllerPreview(
    studentId,
    weekStart ? { weekStart } : undefined,
  )) as MentorshipWeeklyReportPreviewDto;
}

export async function requestWeeklyReportBrief(
  studentId: string,
  weekStart: string,
  sourceFingerprint: string,
  coachContext?: string,
): Promise<MentorshipWeeklyReportPreviewDto> {
  return (await mentorshipWeeklyReportControllerGenerateBrief(studentId, {
    weekStart,
    sourceFingerprint,
    coachContext,
  })) as MentorshipWeeklyReportPreviewDto;
}

export async function readWeeklyReportBrief(
  studentId: string,
  weekStart: string,
): Promise<MentorshipWeeklyReportPreviewDto> {
  return (await mentorshipWeeklyReportControllerReadBrief(studentId, {
    weekStart,
  })) as MentorshipWeeklyReportPreviewDto;
}

export async function finalizeWeeklyReport(
  studentId: string,
  input: {
    weekStart: string;
    sourceFingerprint: string;
    operationId: string;
    coachEvaluation: string | null;
    replacesId?: string | null;
  },
): Promise<MentorshipWeeklyReportDto> {
  return (await mentorshipWeeklyReportControllerFinalize(
    studentId,
    input,
  )) as MentorshipWeeklyReportDto;
}

export async function fetchWeeklyReportArchive(
  studentId: string,
): Promise<Paginated<MentorshipWeeklyReportListItemDto>> {
  return (await mentorshipWeeklyReportControllerList(studentId, {
    page: 1,
    // ponytail: one page at the schema max (~100 finalized versions, well over a prep year of weeks).
    // Add "load more" on `total` if a link ever outgrows it; finalize is unaffected either way.
    pageSize: 100,
  })) as Paginated<MentorshipWeeklyReportListItemDto>;
}

export async function fetchWeeklyReport(
  studentId: string,
  reportId: string,
): Promise<MentorshipWeeklyReportDto> {
  return (await mentorshipWeeklyReportControllerGet(
    studentId,
    reportId,
  )) as MentorshipWeeklyReportDto;
}

export async function fetchWeeklyReportShare(
  studentId: string,
  reportId: string,
): Promise<MentorshipWeeklyReportShareDto> {
  return (await mentorshipWeeklyReportControllerShare(
    studentId,
    reportId,
  )) as MentorshipWeeklyReportShareDto;
}
