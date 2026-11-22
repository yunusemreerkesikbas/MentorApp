import { resolveNotificationMobileRoute } from "@mentor/core";
import type { UserNotificationDto } from "@mentor/types";
import type { AppLocale } from "../stores/preferences.js";
import { formatDisplayDate } from "./display-date.ts";

export type NotificationRecencyGroup = "today" | "week" | "earlier";

export interface NotificationTimeLabels {
  timeJustNow: string;
  timeHoursAgo: (count: number) => string;
  timeYesterday: string;
  timeDaysAgo: (count: number) => string;
}

export interface MobileNotificationDestination {
  pathname: string;
  params?: Record<string, string>;
}

export type NotificationListRow =
  | { kind: "header"; key: string; group: NotificationRecencyGroup }
  | { kind: "item"; key: string; item: UserNotificationDto };

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const STUDENT_CORE_BLOCKED_ROUTES = new Set([
  "/(app)/(tabs)/community",
  "/(app)/(tabs)/students",
  "/(app)/(tabs)/coach-profile",
]);

function recencyGroup(iso: string, now: number): NotificationRecencyGroup {
  const age = now - new Date(iso).getTime();
  if (age < DAY_MS) return "today";
  if (age < 7 * DAY_MS) return "week";
  return "earlier";
}

/**
 * Buckets newest-first notifications into consecutive recency sections matching the web drawer.
 */
export function groupNotificationsByRecency(
  items: readonly UserNotificationDto[],
  now: number = Date.now(),
): { key: NotificationRecencyGroup; items: UserNotificationDto[] }[] {
  const groups: { key: NotificationRecencyGroup; items: UserNotificationDto[] }[] = [];
  for (const item of items) {
    const key = recencyGroup(item.createdAt, now);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, items: [item] });
    }
  }
  return groups;
}

export function flattenNotificationGroups(
  items: readonly UserNotificationDto[],
  now: number = Date.now(),
): NotificationListRow[] {
  const rows: NotificationListRow[] = [];
  const groups = groupNotificationsByRecency(items, now);
  groups.forEach((group, groupIdx) => {
    rows.push({ kind: "header", key: `header-${group.key}-${groupIdx}`, group: group.key });
    for (const item of group.items) {
      rows.push({ kind: "item", key: item.id, item });
    }
  });
  return rows;
}

/**
 * Uses relative labels within the past week (matching the web drawer) and falls back to the
 * localized Europe/Istanbul calendar day for older notifications.
 */
export function formatNotificationTime(
  iso: string,
  locale: AppLocale,
  labels: NotificationTimeLabels,
  now: number = Date.now(),
): string {
  const diffMs = Math.max(0, now - new Date(iso).getTime());
  const diffH = Math.floor(diffMs / HOUR_MS);
  if (diffH < 1) return labels.timeJustNow;
  if (diffH < 24) return labels.timeHoursAgo(diffH);
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return labels.timeYesterday;
  if (diffD < 7) return labels.timeDaysAgo(diffD);
  return formatDisplayDate(iso, locale, "Europe/Istanbul");
}

/**
 * Resolves a notification `linkUrl` via `@mentor/core`, stripping out routes outside the active
 * student-core scope and extracting knowledge article slugs into route params.
 */
export function resolveMobileNotificationDestination(
  linkUrl: string | null | undefined,
  studentCoreOnly: boolean,
): MobileNotificationDestination | null {
  const clean = linkUrl?.trim().split("?")[0]?.split("#")[0] ?? "";
  const withoutLocale = clean.replace(/^\/(tr|en)(?=\/|$)/, "") || "/";

  if (!studentCoreOnly && clean.startsWith("/") && !clean.startsWith("//")) {
    if (withoutLocale === "/my-coach" || withoutLocale === "/kocum") {
      return { pathname: "/(app)/my-coach" };
    }
    const myWeeklyMatch = withoutLocale.match(
      /^\/(?:my-coach|kocum)\/(?:weekly-reports|haftalik-raporlar)\/([^/]+)$/,
    );
    if (myWeeklyMatch?.[1]) {
      return {
        pathname: "/(app)/my-coach-weekly-report",
        params: { reportId: decodeURIComponent(myWeeklyMatch[1]) },
      };
    }
    const inviteMatch = withoutLocale.match(
      /^\/(?:coach-invitation|kocluk-daveti)(?:\/([^/]+))?$/,
    );
    if (inviteMatch) {
      return inviteMatch[1]
        ? { pathname: "/(app)/my-coach", params: { code: decodeURIComponent(inviteMatch[1]) } }
        : { pathname: "/(app)/my-coach" };
    }
    if (
      withoutLocale === "/students/profile" ||
      withoutLocale === "/ogrencilerim/profil" ||
      withoutLocale === "/kocluk/profil" ||
      withoutLocale === "/coach-profile"
    ) {
      return { pathname: "/(app)/(tabs)/students/profile" };
    }
    const studentMatch = withoutLocale.match(
      /^\/(?:students|ogrencilerim|kocluk)\/([^/]+)$/,
    );
    if (studentMatch?.[1] && studentMatch[1] !== "profile" && studentMatch[1] !== "profil") {
      return {
        pathname: "/(app)/coach-student",
        params: { studentId: decodeURIComponent(studentMatch[1]) },
      };
    }
  }

  const route = resolveNotificationMobileRoute(linkUrl);
  if (!route) return null;
  if (studentCoreOnly && STUDENT_CORE_BLOCKED_ROUTES.has(route)) {
    return null;
  }

  if (route === "/(app)/knowledge" && linkUrl) {
    const clean = linkUrl.trim().split("?")[0]?.split("#")[0] ?? "";
    const withoutLocale = clean.replace(/^\/(tr|en)(?=\/|$)/, "");
    const match = withoutLocale.match(/^\/(?:bilgi|knowledge|blog)\/([^/]+)$/);
    if (match?.[1]) {
      return {
        pathname: route,
        params: { slug: decodeURIComponent(match[1]) },
      };
    }
  }

  if (route === "/(app)/(tabs)/community" && !studentCoreOnly && linkUrl) {
    const clean = linkUrl.trim().split("?")[0]?.split("#")[0] ?? "";
    const withoutLocale = clean.replace(/^\/(tr|en)(?=\/|$)/, "");
    const memberMatch = withoutLocale.match(/^\/(?:community|topluluk)\/member\/([^/]+)$/);
    if (memberMatch?.[1]) {
      return {
        pathname: "/(app)/community-member",
        params: { username: decodeURIComponent(memberMatch[1]) },
      };
    }
    const questionMatch = withoutLocale.match(/^\/(?:community|topluluk)\/question\/([^/]+)$/);
    if (questionMatch?.[1]) {
      return {
        pathname: "/(app)/community-thread",
        params: { id: decodeURIComponent(questionMatch[1]), kind: "question" },
      };
    }
    const messageMatch = withoutLocale.match(/^\/(?:community|topluluk)\/message\/([^/]+)$/);
    if (messageMatch?.[1]) {
      return {
        pathname: "/(app)/community-thread",
        params: { id: decodeURIComponent(messageMatch[1]), kind: "thread" },
      };
    }
    if (withoutLocale === "/community/saved" || withoutLocale === "/topluluk/kaydedilenler") {
      return { pathname: "/(app)/community-saved" };
    }
  }

  return { pathname: route };
}
