import { UserRole } from "@mentor/types";

/**
 * Where a coach lives, and which student surfaces they never see (APP-090).
 *
 * APP-089 gave a coach their own onboarding and landed them on `/students`, but only once — login
 * still sent every authenticated user to `/dashboard`, so from the second visit onwards a coach
 * opened a screen built for somebody else: streak flames, a Pomodoro ritual, "Bu yolun sonunda ne
 * var?" and a mood prompt. None of it is their work.
 *
 * One module rather than a check per screen, because the same two facts drive three places: the
 * post-auth redirect, the `(app)` guard, and which nav items render.
 */

export const COACH_HOME = "/students";

export function isCoach(user: { roles: readonly string[] } | null | undefined): boolean {
  return user?.roles.includes(UserRole.COACH) ?? false;
}

/**
 * The student's daily ritual and study tools, matched on BOTH the canonical route name and its
 * Turkish segment.
 *
 * Two forms because `usePathname` does not reliably hand back the canonical one — `lib/app-sidebar.ts`
 * already defends the same way (`community|topluluk`), and a single-form regex there would have
 * silently stopped matching. Follow that pattern rather than trusting the locale.
 *
 * A BLOCK list, not an allow list, and that direction is the decision. This guard is a courtesy:
 * the worst a coach sees on a student screen is their own empty data, so failing open costs
 * nothing, while failing closed would mean any `(app)` route added later silently disappears for
 * coaches until somebody remembers this file. The surfaces a coach genuinely needs — settings,
 * profile, subscription (Koç Pro is bought there), community (roadmap §5 makes the forum their
 * showcase) and knowledge — are simply absent from the list.
 */
const STUDENT_ONLY = [
  "dashboard|panel",
  "plan",
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
