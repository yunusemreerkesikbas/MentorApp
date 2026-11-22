import {
  http,
  mentorshipWeeklyReportControllerFinalize,
  mentorshipWeeklyReportControllerGenerateBrief,
  mentorshipWeeklyReportControllerGet,
  mentorshipWeeklyReportControllerList,
  mentorshipWeeklyReportControllerPreview,
  mentorshipWeeklyReportControllerReadBrief,
  mentorshipWeeklyReportControllerShare,
} from "@mentor/api-client";
import type {
  MentorshipWeeklyEvidenceKind,
  MentorshipWeeklyReportDto,
  MentorshipWeeklyReportListItemDto,
  MentorshipWeeklyReportPreviewDto,
  MentorshipWeeklyReportShareDto,
  Paginated,
} from "@mentor/types";

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
  if (kind === "COMPLETION_RATE") {
    return `${Math.round(value * 100)}%`;
  }
  if (kind === "FOCUS_MINUTES") {
    return `${Math.round(value)} ${locale === "tr" ? "dk" : "min"}`;
  }
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR").format(value);
}

export async function fetchWeeklyReportPreview(
  studentId: string,
  weekStart?: string,
): Promise<MentorshipWeeklyReportPreviewDto> {
  return (await mentorshipWeeklyReportControllerPreview(
    studentId,
    weekStart ? { weekStart } : undefined,
  )) as unknown as MentorshipWeeklyReportPreviewDto;
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
  })) as unknown as MentorshipWeeklyReportPreviewDto;
}

export async function readWeeklyReportBrief(
  studentId: string,
  weekStart: string,
): Promise<MentorshipWeeklyReportPreviewDto> {
  return (await mentorshipWeeklyReportControllerReadBrief(studentId, {
    weekStart,
  })) as unknown as MentorshipWeeklyReportPreviewDto;
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
  )) as unknown as MentorshipWeeklyReportDto;
}

export async function fetchWeeklyReportArchive(
  studentId: string,
): Promise<Paginated<MentorshipWeeklyReportListItemDto>> {
  return (await mentorshipWeeklyReportControllerList(studentId, {
    page: 1,
    pageSize: 100,
  })) as unknown as Paginated<MentorshipWeeklyReportListItemDto>;
}

export async function fetchWeeklyReport(
  studentId: string,
  reportId: string,
): Promise<MentorshipWeeklyReportDto> {
  return (await mentorshipWeeklyReportControllerGet(
    studentId,
    reportId,
  )) as unknown as MentorshipWeeklyReportDto;
}

export async function fetchWeeklyReportShare(
  studentId: string,
  reportId: string,
): Promise<MentorshipWeeklyReportShareDto> {
  return (await mentorshipWeeklyReportControllerShare(
    studentId,
    reportId,
  )) as unknown as MentorshipWeeklyReportShareDto;
}

export async function fetchMyWeeklyReports(): Promise<
  Paginated<MentorshipWeeklyReportListItemDto>
> {
  return (await http<Paginated<MentorshipWeeklyReportListItemDto>>(
    "/v1/mentorship/my-coach/weekly-reports?page=1&pageSize=100",
  )) as Paginated<MentorshipWeeklyReportListItemDto>;
}

export async function fetchMyWeeklyReport(
  reportId: string,
): Promise<MentorshipWeeklyReportShareDto> {
  return (await http<MentorshipWeeklyReportShareDto>(
    `/v1/mentorship/my-coach/weekly-reports/${encodeURIComponent(reportId)}`,
  )) as MentorshipWeeklyReportShareDto;
}
