import { UserRole } from "@mentor/types";

/**
 * Where a coach lives, and which student-only surfaces they never see (APP-090/APP-091).
 * Shared across web and mobile so post-auth redirects, route guards, and nav bars stay identical.
 */
export const COACH_HOME = "/students" as const;
export const STUDENT_HOME = "/dashboard" as const;

export function isCoach(user: { roles: readonly string[] } | null | undefined): boolean {
  return user?.roles.includes(UserRole.COACH) ?? false;
}

export function homePathForUser(user: { roles: readonly string[] } | null | undefined): string {
  return isCoach(user) ? COACH_HOME : STUDENT_HOME;
}

const STUDENT_ONLY = [
  "dashboard|panel",
  "study-session|seans",
  "analysis|analiz",
  "notebook|yanlis-defteri",
  "notebooks|defterlerim",
  "vision-board|hedef",
  // The AI companion chat. `/coach` is Puhu; the human-coach surface is `/students` (TR `/kocluk`).
  "coach|koc",
  // The student's own side of mentorship: their coach, and accepting an invite from one.
  "my-coach|kocum",
  "coach-invitation|kocluk-daveti",
] as const;

const STUDENT_ONLY_PATTERN = new RegExp(
  `(?:^|/)(?:${STUDENT_ONLY.join("|")})(?:/|$)`,
);

export function isStudentOnlyPath(pathname: string): boolean {
  return STUDENT_ONLY_PATTERN.test(pathname);
}
