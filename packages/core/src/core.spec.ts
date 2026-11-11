import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UserRole } from "@mentor/types";
import {
  APP_NAV_ITEMS,
  COACH_HOME,
  STUDENT_HOME,
  availableAppDestination,
  blockedAppFeature,
  dativeOf,
  filterVisibleNavItems,
  firstName,
  genitiveOf,
  getMobileTabItemsForRole,
  greetingKeyForHour,
  hasCompletedOnboarding,
  homePathForUser,
  isCoach,
  isNavActive,
  isStudentOnlyPath,
  isWaitlistEmail,
  isWaitlistOn,
  nextOnboardingStep,
  onboardingProgress,
  opensWaitlist,
  postAuthDestination,
  previousOnboardingStep,
  safeNextPath,
  shiftDate,
  taskStats,
  toLocaleUpper,
  weekCompletionStats,
  weekDates,
  weekStart,
  formatTimerDisplay,
  parseInitialMinutes,
  parseInitialPreset,
  emptyScores,
  groupTopicsBySubjectName,
  paperSubjects,
  validateSubjectCounts,
  withScore,
  classifyStudyRoomJoinErrorCode,
  normalizeStudyRoomCode,
  resolveNotificationMobileRoute,
} from "../dist/index.js";

describe("@mentor/core shared domain helpers", () => {
  it("resolves coach vs student surfaces accurately", () => {
    const student = { roles: [UserRole.STUDENT] };
    const coach = { roles: [UserRole.COACH] };

    assert.equal(isCoach(student), false);
    assert.equal(isCoach(coach), true);
    assert.equal(homePathForUser(student), STUDENT_HOME);
    assert.equal(homePathForUser(coach), COACH_HOME);
    assert.equal(isStudentOnlyPath("/dashboard"), true);
    assert.equal(isStudentOnlyPath("/en/dashboard"), true);
    assert.equal(isStudentOnlyPath("/students"), false);
    assert.equal(isStudentOnlyPath("/settings"), false);
  });

  it("evaluates feature route availability gates", () => {
    const student = { username: "ayse", roles: [UserRole.STUDENT] };
    assert.equal(blockedAppFeature("/coach/chat", student, null), "aiCoach");
    assert.equal(
      blockedAppFeature("/coach/chat", student, {
        aiCoach: true,
        economy: true,
        social: true,
        forum: true,
        studyRooms: true,
        humanCoaching: true,
        coachRegistration: true,
        studentPurchases: true,
        studentSignup: true,
        signupWaitlist: false,
        invites: true,
        preferenceSimulation: false,
      }),
      null,
    );
    assert.equal(
      availableAppDestination(
        "/dashboard",
        { username: "koc", roles: [UserRole.COACH] },
        null,
      ),
      null,
    );
  });

  it("computes visible nav items and role-based mobile tabs", () => {
    const studentTabs = getMobileTabItemsForRole([UserRole.STUDENT]);
    assert.deepEqual(
      studentTabs.map((t) => t.labelKey),
      ["home", "plan", "coach", "analysis", "community"],
    );

    const coachTabs = getMobileTabItemsForRole([UserRole.COACH]);
    assert.deepEqual(
      coachTabs.map((t) => t.labelKey),
      ["plan", "community", "students", "coach_profile", "settings"],
    );

    const visibleForCoach = filterVisibleNavItems(APP_NAV_ITEMS, [UserRole.COACH]);
    assert.equal(
      visibleForCoach.some((item) => item.labelKey === "home"),
      false,
    );
  });

  it("matches active navigation prefixes without sibling collisions", () => {
    assert.equal(isNavActive("/students", "/students"), true);
    assert.equal(isNavActive("/students/123", "/students"), true);
    assert.equal(isNavActive("/students/profile", "/students"), false);
    assert.equal(isNavActive("/students/profile", "/students/profile"), true);
  });

  it("formats Turkish greetings and case suffixes", () => {
    assert.equal(greetingKeyForHour(8), "greeting_morning");
    assert.equal(greetingKeyForHour(14), "greeting_day");
    assert.equal(greetingKeyForHour(21), "greeting_evening");
    assert.equal(firstName("Ayşe Yılmaz"), "Ayşe");
    assert.equal(dativeOf("Mert"), "Mert'e");
    assert.equal(dativeOf("Ayşe"), "Ayşe'ye");
    assert.equal(genitiveOf("Elif"), "Elif'in");
    assert.equal(toLocaleUpper("iıöüçşğ", "tr"), "İIÖÜÇŞĞ");
  });

  it("walks onboarding steps for student and coach audiences", () => {
    assert.equal(nextOnboardingStep("exam", "KPSS", "student"), "kpssLevel");
    assert.equal(previousOnboardingStep("why", "KPSS", "student"), "kpssLevel");
    assert.equal(nextOnboardingStep("exam", "YKS", "student"), "why");
    assert.equal(previousOnboardingStep("why", "YKS", "student"), "exam");
    assert.equal(nextOnboardingStep("exam", "YKS", "coach"), "coachProfile");
    assert.deepEqual(onboardingProgress("exam", "student"), { done: 1, total: 7 });
    assert.equal(onboardingProgress("intro", "student"), null);
  });

  it("evaluates auth flow and waitlist helpers", () => {
    assert.equal(
      hasCompletedOnboarding({ username: "ayse", examType: "YKS" }),
      true,
    );
    assert.equal(
      hasCompletedOnboarding({ username: null, examType: "YKS" }),
      false,
    );
    assert.equal(safeNextPath("/plan"), "/plan");
    assert.equal(safeNextPath("//evil.com"), null);
    assert.equal(safeNextPath("https://evil.com"), null);
    assert.equal(isWaitlistOn(null), true);
    assert.equal(opensWaitlist("AUTH_PILOT_INVITATION_REQUIRED"), true);
    assert.equal(opensWaitlist("OTHER_ERROR"), false);
    assert.equal(isWaitlistEmail("ayse@example.com"), true);
    assert.equal(isWaitlistEmail("invalid-email"), false);
    assert.equal(
      postAuthDestination(
        {
          id: "1",
          email: "a@b.com",
          displayName: "Ayse",
          username: "ayse",
          avatarUrl: null,
          bio: null,
          website: null,
          roles: [UserRole.STUDENT],
          organizationId: null,
          examType: "YKS",
          examVariant: null,
          examDate: null,
          dailyFocusGoalMinutes: 120,
          careerGroup: null,
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00Z",
        },
        null,
        null,
      ),
      "/dashboard",
    );
  });

  it("computes Istanbul plan dates, week ranges, and Pomodoro timer formatting", () => {
    assert.equal(shiftDate("2026-11-09", 3), "2026-11-12");
    assert.equal(weekStart("2026-11-11"), "2026-11-09");
    assert.equal(weekDates("2026-11-09").length, 7);
    assert.deepEqual(
      taskStats([{ status: "DONE" }, { status: "PENDING" }]),
      { done: 1, total: 2, percent: 50 },
    );
    assert.deepEqual(
      weekCompletionStats(
        { "2026-11-09": [{ status: "DONE" }], "2026-11-10": [{ status: "PENDING" }] },
        "2026-11-09",
      ),
      { done: 1, total: 2, percent: 50 },
    );
    assert.equal(formatTimerDisplay(1505), "25:05");
    assert.equal(parseInitialMinutes("50_10", null), 50);
    assert.equal(parseInitialPreset(null, "45"), "custom");
  });

  it("auto-computes mock exam subject blanks, validates question counts, and groups topics", () => {
    const subjects = [
      { id: "1", slug: "turkce", name: "Türkçe", questionCount: 40, sortOrder: 1 },
      { id: "2", slug: "diger", name: "Diğer", questionCount: null, sortOrder: 2 },
    ];
    assert.equal(paperSubjects(subjects).length, 1);
    const initial = emptyScores(subjects);
    const afterCorrect = withScore(initial.turkce!, "correct", "30", 40);
    const afterWrong = withScore(afterCorrect, "wrong", "5", 40);
    assert.equal(afterWrong.blank, "5");
    assert.equal(
      validateSubjectCounts(subjects, { turkce: afterWrong }),
      null,
    );
    const overflow = withScore(afterWrong, "wrong", "15", 40);
    assert.equal(
      validateSubjectCounts(subjects, { turkce: overflow }),
      "turkce",
    );

    const grouped = groupTopicsBySubjectName([
      {
        id: "t1",
        slug: "paragraf",
        name: "Paragraf",
        subjectId: "1",
        subjectSlug: "turkce",
        subjectName: "Türkçe",
        sortOrder: 1,
      },
    ]);
    assert.deepEqual(grouped.subjects, ["Türkçe"]);
    assert.deepEqual(grouped.topicsBySubject.get("Türkçe"), ["Paragraf"]);
  });

  it("classifies study room join error codes and normalizes invite codes", () => {
    assert.equal(
      classifyStudyRoomJoinErrorCode("COACHING_ROOM_ALREADY_MEMBER"),
      "already_member",
    );
    assert.equal(
      classifyStudyRoomJoinErrorCode("COACHING_ROOM_CODE_INVALID"),
      "invalid",
    );
    assert.equal(
      classifyStudyRoomJoinErrorCode("COACHING_ROOM_FULL"),
      "full",
    );
    assert.equal(normalizeStudyRoomCode("  masa-ab12cd "), "MASA-AB12CD");
  });

  it("maps notification linkUrl paths to safe mobile routes", () => {
    assert.equal(
      resolveNotificationMobileRoute("/tr/panel"),
      "/(app)/(tabs)/dashboard",
    );
    assert.equal(
      resolveNotificationMobileRoute("/koc/sohbet?thread=1"),
      "/(app)/(tabs)/coach",
    );
    assert.equal(
      resolveNotificationMobileRoute("/topluluk/oda/123"),
      "/(app)/(tabs)/community",
    );
    assert.equal(
      resolveNotificationMobileRoute("https://evil.example.com"),
      null,
    );
    assert.equal(resolveNotificationMobileRoute("//evil.example.com"), null);
  });
});
