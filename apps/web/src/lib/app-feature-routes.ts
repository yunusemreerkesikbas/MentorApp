import type { AppAvailabilityDto } from "@mentor/types";
import { isCoach, isStudentOnlyPath } from "./coach-surface";

type Viewer = { username: string | null; roles: readonly string[] };
type Feature = keyof AppAvailabilityDto;

function barePath(path: string): string {
  return path.split(/[?#]/, 1)[0]!.replace(/^\/(?:tr|en)(?=\/)/, "");
}

/** Presentation only. Every operation keeps its own server authorization and feature policy. */
export function blockedAppFeature(path: string, user: Viewer | null, availability: AppAvailabilityDto | null): Feature | null {
  const pathname = barePath(path);
  if (isCoach(user) && (isStudentOnlyPath(pathname) || pathname === "/plan") && !availability?.humanCoaching) return "humanCoaching";
  const member = /^\/(?:community\/member|topluluk\/uye)\/([^/]+)(?:\/(?:achievements|rozetler))?\/?$/.exec(pathname);
  let feature: Feature | null = null;
  if (member) {
    if (user?.username === member[1]) return null;
    feature = "social";
  } else if (/^\/(?:coach|koc)(?:\/|$)/.test(pathname)) feature = "aiCoach";
  else if (/^\/(?:coach-application|koc-ol|become-a-coach)(?:\/|$)/.test(pathname)) feature = "coachRegistration";
  else if (/^\/(?:students|coaching\/students|kocluk|my-coach|kocum|coach-invitation|kocluk-daveti)(?:\/|$)/.test(pathname)) feature = "humanCoaching";
  else if (/^\/(?:study-session\/rooms|seans\/masa|seans\/masalar|join-room|masaya-katil)(?:\/|$)/.test(pathname)) feature = "studyRooms";
  else if (/^\/(?:community|topluluk)(?:\/|$)/.test(pathname)) feature = "forum";
  else if (/^\/(?:invite|davet)(?:\/|$)/.test(pathname)) feature = "invites";
  return feature && !availability?.[feature] ? feature : null;
}

/** Receives an already same-origin-validated destination from the auth/onboarding helpers. */
export function availableAppDestination(next: string | null, user: Viewer | null, availability: AppAvailabilityDto | null): string | null {
  if (!next || blockedAppFeature(next, user, availability)) return null;
  const pathname = barePath(next);
  const [target, hash] = next.split("#", 2);
  const [base, search] = target!.split("?", 2);
  const query = new URLSearchParams(search);
  if (!availability?.studyRooms && /^\/(?:study-session|seans)$/.test(pathname)) {
    for (const key of ["katil", "join", "roomId", "room"]) query.delete(key);
  }
  if (!availability?.aiCoach && pathname === "/plan") query.delete("coach");
  const suffix = query.toString();
  return `${base}${suffix ? `?${suffix}` : ""}${hash === undefined ? "" : `#${hash}`}`;
}
