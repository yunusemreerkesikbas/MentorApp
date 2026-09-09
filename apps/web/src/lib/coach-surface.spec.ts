import { describe, expect, it } from "vitest";

import { COACH_HOME, isCoach, isStudentOnlyPath } from "./coach-surface";

describe("isCoach", () => {
  it("reads the COACH role off the principal", () => {
    expect(isCoach({ roles: ["STUDENT", "COACH"] })).toBe(true);
    expect(isCoach({ roles: ["STUDENT"] })).toBe(false);
  });

  it("treats a missing principal as not a coach", () => {
    expect(isCoach(null)).toBe(false);
    expect(isCoach(undefined)).toBe(false);
  });
});

describe("isStudentOnlyPath", () => {
  it("blocks the daily ritual and the study tools", () => {
    for (const path of [
      "/dashboard",
      "/plan",
      "/study-session",
      "/study-session/history",
      "/analysis",
      "/analysis/recap",
      "/notebook",
      "/notebooks",
      "/vision-board",
      "/vision-board/board",
      "/coach",
      "/coach/chat",
      "/my-coach",
      "/coach-invitation",
    ]) {
      expect(isStudentOnlyPath(path), path).toBe(true);
    }
  });

  it("blocks the Turkish segment too", () => {
    // `usePathname` does not reliably hand back the canonical name, which is why `app-sidebar.ts`
    // matches both forms. A regex that only knew the English one would stop blocking anything the
    // moment a Turkish path arrived.
    for (const path of [
      "/panel",
      "/seans",
      "/analiz",
      "/analiz/haftanin-hikayesi",
      "/yanlis-defteri",
      "/defterlerim",
      "/hedef/pano",
      "/koc",
      "/koc/sohbet",
      "/kocum",
      "/kocluk-daveti",
    ]) {
      expect(isStudentOnlyPath(path), path).toBe(true);
    }
  });

  it("survives a locale prefix", () => {
    expect(isStudentOnlyPath("/en/dashboard")).toBe(true);
    expect(isStudentOnlyPath("/en/coach/chat")).toBe(true);
  });

  it("leaves the account surfaces a coach genuinely needs", () => {
    // Blocking any of these would be a bug, not a feature: Koç Pro is bought on /abonelik, and a
    // coach locked out of /ayarlar cannot change their password or delete their account.
    for (const path of [
      "/settings",
      "/ayarlar",
      "/profile",
      "/profil",
      "/subscription",
      "/abonelik",
      "/community",
      "/topluluk",
      "/community/kpss/threads/1",
      "/knowledge",
      "/bilgi",
      "/bilgi/kpss-basvuru",
    ]) {
      expect(isStudentOnlyPath(path), path).toBe(false);
    }
  });

  /*
   * The near-misses, and the reason this file exists. Three coach routes contain a blocked token as
   * a PREFIX of their own segment, so a regex without the trailing boundary would lock a coach out
   * of their own surface and out of the form that makes them one.
   */
  it("does not mistake the coach's own routes for the student's", () => {
    expect(isStudentOnlyPath(COACH_HOME)).toBe(false);
    for (const path of [
      "/kocluk", // contains "koc"
      "/kocluk/profil",
      "/kocluk/11111111-1111-4111-8111-111111111111",
      "/coaching/students", // contains "coach"
      "/coaching/students/11111111-1111-4111-8111-111111111111",
      "/koc-basvurusu", // contains "koc" — the registration form, reached BEFORE anyone is a coach
      "/coach-application",
    ]) {
      expect(isStudentOnlyPath(path), path).toBe(false);
    }
  });
});
