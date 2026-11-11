import { UserRole } from "@mentor/types";
import { isCoach } from "./coach-surface.js";

/** Nav items that live under another item's path; on them, only the nested item is active. */
const NESTED_ITEMS = ["/students/profile"] as const;

const within = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * Nav active state — exact match or nested path; avoids `/dashboard` matching `/plan`.
 * A nested item (the coach profile under Öğrencilerim) takes its pages from the parent.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (!within(pathname, href)) return false;
  return !NESTED_ITEMS.some(
    (nested) => nested !== href && nested.startsWith(`${href}/`) && within(pathname, nested),
  );
}

export type AppNavIconId =
  | "students"
  | "home"
  | "plan"
  | "coach"
  | "analysis"
  | "notebook"
  | "community"
  | "coachProfile"
  | "settings";

export interface AppNavItemDefinition {
  readonly href: string;
  readonly labelKey: string;
  readonly icon: AppNavIconId;
  readonly roles?: readonly UserRole[];
  readonly studentOnly?: boolean;
  readonly sidebarOnly?: boolean;
  readonly sidebarExclude?: boolean;
}

export const APP_NAV_ITEMS: readonly AppNavItemDefinition[] = [
  {
    href: "/students",
    labelKey: "students",
    icon: "students",
    roles: [UserRole.COACH],
  },
  { href: "/dashboard", labelKey: "home", icon: "home", studentOnly: true },
  { href: "/plan", labelKey: "plan", icon: "plan" },
  {
    href: "/coach",
    labelKey: "coach",
    icon: "coach",
    sidebarExclude: true,
    studentOnly: true,
  },
  {
    href: "/analysis",
    labelKey: "analysis",
    icon: "analysis",
    studentOnly: true,
  },
  {
    href: "/notebooks",
    labelKey: "notebook",
    icon: "notebook",
    sidebarOnly: true,
    studentOnly: true,
  },
  { href: "/community", labelKey: "community", icon: "community" },
  {
    href: "/students/profile",
    labelKey: "coach_profile",
    icon: "coachProfile",
    roles: [UserRole.COACH],
  },
  {
    href: "/settings",
    labelKey: "settings",
    icon: "settings",
    sidebarOnly: true,
  },
] as const;

/** The raised centre of the tab pill: each role sees exactly one of these. */
export const ELEVATED_NAV_HREFS: readonly string[] = ["/coach", "/students"] as const;

export function isElevatedNavHref(href: string): boolean {
  return ELEVATED_NAV_HREFS.includes(href);
}

export function filterVisibleNavItems<T extends AppNavItemDefinition>(
  items: readonly T[],
  roles: readonly string[] | undefined,
): readonly T[] {
  const coach = isCoach({ roles: roles ?? [] });
  return items.filter((item) => {
    if (coach && item.studentOnly) return false;
    if (!item.roles) return true;
    return item.roles.some((role) => roles?.includes(role));
  });
}

/**
 * Resolves the 5-item mobile bottom tab bar for either a student or a human coach,
 * placing the role's primary companion/workspace action in the raised centre slot.
 */
export function getMobileTabItemsForRole(
  roles: readonly string[] | undefined,
): readonly AppNavItemDefinition[] {
  if (!isCoach({ roles: roles ?? [] })) {
    return filterVisibleNavItems(
      APP_NAV_ITEMS.filter((item) => !item.sidebarOnly),
      roles,
    );
  }
  const sidebarItems = APP_NAV_ITEMS.filter((item) => !item.sidebarExclude);
  const items = filterVisibleNavItems(sidebarItems, roles);
  const home = items.filter((item) => item.href === "/students");
  const rest = items.filter((item) => item.href !== "/students");
  const middle = Math.floor(rest.length / 2);
  return [...rest.slice(0, middle), ...home, ...rest.slice(middle)];
}
