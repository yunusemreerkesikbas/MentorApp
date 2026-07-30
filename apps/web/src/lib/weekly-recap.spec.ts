// The repository reuses apps/api's Vitest runner; apps/web intentionally has no test dependency.
// @ts-expect-error -- resolved by the explicit @mentor/api Vitest command used for this spec.
import { describe, expect, it, vi } from "vitest";
import type { WeeklyRecapTitleId, WeeklyReviewDto } from "@mentor/types";
import {
  advanceWeeklyRecapPlayback,
  buildWeeklyRecapTeaserHref,
  buildWeeklyRecapShareCardModel,
  buildWeeklyRecapShareText,
  composeWeeklyRecapSlides,
  createWeeklyRecapPlayback,
  getFocusStoryMode,
  getWeeklyRecapFocusTimeMessage,
  getWeeklyRecapPeakDayStory,
  getWeeklyRecapWeekMapPhase,
  getPerformanceStoryMode,
  getWeeklyRecapTeaserState,
  getWeeklyRecapTextBeat,
  getWeeklyBestStorySource,
  WEEKLY_RECAP_AUDIO_ASSETS,
  WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS,
  WEEKLY_RECAP_FIGMA_ASSETS,
  WEEKLY_RECAP_VIDEO_ASSETS,
  markWeeklyRecapOpened,
  navigateWeeklyRecapPlayback,
  replayWeeklyRecap,
  shouldNavigateAfterWeeklyRecapPress,
  shouldWeeklyRecapAdvance,
  weeklyRecapExitHref,
  weeklyRecapOpenedKey,
} from "./weekly-recap";
import { buildWeeklyRecapShareCardRows } from "./weekly-recap-share-card";

function review(
  status: WeeklyReviewDto["recap"]["status"],
  overrides: Partial<WeeklyReviewDto> = {},
): WeeklyReviewDto {
  return {
    period: {
      startDate: "2026-07-13",
      endDate: "2026-07-19",
      timeZone: "Europe/Istanbul",
    },
    status: status === "READY" ? "READY" : "INSUFFICIENT",
    recap: {
      status,
      activeDays: 0,
      weeklyTitle: null,
      nextStorySignal: null,
      nextStorySignals: [],
      closingMessage: "Yanındayım.",
    },
    evidence: {
      mockExamCount: 0,
      completedSessionCount: 0,
      qualifyingSessionCount: 0,
      completedPlanTaskCount: 0,
    },
    rhythm: {
      completedSessionCount: 0,
      focusMinutes: 0,
      activeDays: 0,
      longestSessionMinutes: 0,
      longestActiveRun: 0,
      focusTimeBand: null,
      peakFocusDay: null,
      days: [],
      subjectBreakdown: [],
      moodCheckinCount: 0,
      energySignal: null,
      message: "Ritim",
    },
    plan: {
      completedTaskCount: 0,
      subjectBreakdown: [],
      message: "Plan",
    },
    highlights: [],
    performance: null,
    focus: null,
    suggestedTask: null,
    ...overrides,
  };
}

describe("composeWeeklyRecapSlides", () => {
  it("attaches the matching full-frame reveal and poster to every weekly character", () => {
    const characterAssets: Array<{
      id: WeeklyRecapTitleId;
      video: string;
      poster: string;
    }> = [
      {
        id: "BALANCE_MASTER",
        video: WEEKLY_RECAP_VIDEO_ASSETS.cosmicMaestro,
        poster: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.cosmicMaestro,
      },
      {
        id: "RHYTHM_GUARDIAN",
        video: WEEKLY_RECAP_VIDEO_ASSETS.timeBender,
        poster: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.timeBender,
      },
      {
        id: "FOCUS_DIVER",
        video: WEEKLY_RECAP_VIDEO_ASSETS.nebulaDiver,
        poster: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.nebulaDiver,
      },
      {
        id: "PLAN_ARCHITECT",
        video: WEEKLY_RECAP_VIDEO_ASSETS.routeArchitect,
        poster: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.routeArchitect,
      },
      {
        id: "SUBJECT_EXPLORER",
        video: WEEKLY_RECAP_VIDEO_ASSETS.dimensionExplorer,
        poster: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.dimensionExplorer,
      },
      {
        id: "MOCK_BRAVE",
        video: WEEKLY_RECAP_VIDEO_ASSETS.phoenixPilot,
        poster: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.phoenixPilot,
      },
      {
        id: "FOCUS_TRAVELER",
        video: WEEKLY_RECAP_VIDEO_ASSETS.novaTraveler,
        poster: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.novaTraveler,
      },
    ];

    for (const character of characterAssets) {
      const slides = composeWeeklyRecapSlides(
        review("READY", {
          recap: {
            status: "READY",
            activeDays: 2,
            weeklyTitle: {
              id: character.id,
              label: "Test karakteri",
              message: "Test mesajı.",
            },
            nextStorySignal: null,
            nextStorySignals: [],
            closingMessage: "Hikâyen devam ediyor.",
          },
        }),
      );
      const characterSlide = slides.find(
        (slide) => slide.kind === "weekly_title",
      );

      expect(characterSlide?.characterVideo).toEqual({
        src: character.video,
        posterSrc: character.poster,
        headlineAtMs: 4_000,
        supportAtMs: 6_000,
      });
      expect(characterSlide).toMatchObject({
        audioSrc: WEEKLY_RECAP_AUDIO_ASSETS.characterReveal,
        audioStartSeconds: 0,
      });
    }
  });

  it("builds the fixed eight-screen READY story with presentation timing", () => {
    const result = composeWeeklyRecapSlides(
      review("READY", {
        recap: {
          status: "READY",
          activeDays: 3,
          weeklyTitle: {
            id: "FOCUS_DIVER",
            label: "Nebula Dalgıcı",
            message: "80 dakika derinleştin.",
          },
          nextStorySignal: null,
          nextStorySignals: [],
          closingMessage: "Yanındayım.",
        },
        evidence: {
          mockExamCount: 1,
          completedSessionCount: 2,
          qualifyingSessionCount: 2,
          completedPlanTaskCount: 3,
        },
        rhythm: {
          completedSessionCount: 2,
          focusMinutes: 50,
          activeDays: 3,
          longestSessionMinutes: 30,
          longestActiveRun: 3,
          focusTimeBand: null,
          peakFocusDay: null,
          days: [],
          subjectBreakdown: [
            {
              subjectRef: "matematik",
              subjectName: "Matematik",
              focusMinutes: 50,
              qualifyingSessionCount: 2,
            },
          ],
          moodCheckinCount: 0,
          energySignal: null,
          message: "Ritim",
        },
        plan: {
          completedTaskCount: 3,
          subjectBreakdown: [],
          message: "Plan",
        },
        highlights: [
          {
            kind: "LONGEST_SESSION",
            minutes: 30,
            message: "30 dakika.",
          },
          {
            kind: "TOP_FOCUS_SUBJECT",
            subjectRef: "matematik",
            subjectName: "Matematik",
            focusMinutes: 50,
            message: "Matematik.",
          },
        ],
        performance: {
          mockExamCount: 1,
          averageNet: "55",
          previousWeekAverageNet: null,
          delta: null,
          evidenceLevel: "EARLY",
          message: "Performans",
        },
      }),
    );

    expect(result.map((slide) => slide.kind)).toEqual([
      "welcome",
      "week_map",
      "focus",
      "weekly_run",
      "weekly_best",
      "performance",
      "weekly_title",
      "final",
    ]);
    expect(result.map((slide) => slide.durationMs)).toEqual([
      10_000, 7_000, 7_000, 7_000, 7_000, 7_000, 8_000, 7_000,
    ]);
    expect(
      result.map(({ kind, audioSrc, audioStartSeconds }) => ({
        kind,
        audioSrc,
        audioStartSeconds,
      })),
    ).toEqual([
      {
        kind: "welcome",
        audioSrc: WEEKLY_RECAP_AUDIO_ASSETS.popTrack03,
        audioStartSeconds: 0,
      },
      {
        kind: "week_map",
        audioSrc: WEEKLY_RECAP_AUDIO_ASSETS.gimmeThatGroove,
        audioStartSeconds: 0,
      },
      {
        kind: "focus",
        audioSrc: WEEKLY_RECAP_AUDIO_ASSETS.digitalClouds,
        audioStartSeconds: 0,
      },
      {
        kind: "weekly_run",
        audioSrc: WEEKLY_RECAP_AUDIO_ASSETS.gimmeThatGroove,
        audioStartSeconds: 14,
      },
      {
        kind: "weekly_best",
        audioSrc: WEEKLY_RECAP_AUDIO_ASSETS.funkeeMonkeee,
        audioStartSeconds: 0,
      },
      {
        kind: "performance",
        audioSrc: WEEKLY_RECAP_AUDIO_ASSETS.digitalClouds,
        audioStartSeconds: 14,
      },
      {
        kind: "weekly_title",
        audioSrc: WEEKLY_RECAP_AUDIO_ASSETS.characterReveal,
        audioStartSeconds: 0,
      },
      {
        kind: "final",
        audioSrc: WEEKLY_RECAP_AUDIO_ASSETS.discover,
        audioStartSeconds: 0,
      },
    ]);
    expect(result).toHaveLength(8);
  });

  it("builds a seven-screen PARTIAL story when focus and rhythm evidence exist", () => {
    const result = composeWeeklyRecapSlides(
      review("PARTIAL", {
        recap: {
          status: "PARTIAL",
          activeDays: 2,
          weeklyTitle: null,
          nextStorySignal: {
            kind: "MOCK_EXAM",
            title: "Deneme radarını aç",
            message: "Bir sonraki denemenden sonra birlikte bakalım.",
          },
          nextStorySignals: [
            {
              kind: "MOCK_EXAM",
              title: "Deneme radarını aç",
              message: "Bir sonraki denemenden sonra birlikte bakalım.",
            },
          ],
          closingMessage: "Küçük izler var.",
        },
        evidence: {
          mockExamCount: 0,
          completedSessionCount: 1,
          qualifyingSessionCount: 1,
          completedPlanTaskCount: 1,
        },
        rhythm: {
          completedSessionCount: 1,
          focusMinutes: 25,
          activeDays: 2,
          longestSessionMinutes: 25,
          longestActiveRun: 2,
          focusTimeBand: null,
          peakFocusDay: null,
          days: [],
          subjectBreakdown: [],
          moodCheckinCount: 0,
          energySignal: null,
          message: "Ritim",
        },
        plan: {
          completedTaskCount: 1,
          subjectBreakdown: [],
          message: "Plan",
        },
        highlights: [
          {
            kind: "LONGEST_SESSION",
            minutes: 25,
            message: "25 dakika.",
          },
        ],
      }),
    );

    expect(result.map((slide) => slide.kind)).toEqual([
      "welcome",
      "week_map",
      "focus",
      "weekly_run",
      "spark",
      "partial_unlocks",
      "partial_final",
    ]);
    expect(result.every((slide) => slide.audioSrc !== null)).toBe(true);
    expect(result).toHaveLength(7);
  });

  it("keeps a task-only PARTIAL story to five screens", () => {
    const result = composeWeeklyRecapSlides(
      review("PARTIAL", {
        recap: {
          status: "PARTIAL",
          activeDays: 1,
          weeklyTitle: null,
          nextStorySignal: {
            kind: "FOCUS_SESSION",
            title: "Odak ateşini yak",
            message: "Bir odak seansı tamamla.",
          },
          nextStorySignals: [
            {
              kind: "FOCUS_SESSION",
              title: "Odak ateşini yak",
              message: "Bir odak seansı tamamla.",
            },
            {
              kind: "MOCK_EXAM",
              title: "Deneme radarını aç",
              message: "Bir deneme gir.",
            },
          ],
          closingMessage: "Küçük izler var.",
        },
        evidence: {
          mockExamCount: 0,
          completedSessionCount: 0,
          qualifyingSessionCount: 0,
          completedPlanTaskCount: 1,
        },
        plan: {
          completedTaskCount: 1,
          subjectBreakdown: [],
          message: "Plan",
        },
        highlights: [
          {
            kind: "COMPLETED_TASKS",
            completedTaskCount: 1,
            message: "Bir görevi tamamladın.",
          },
        ],
      }),
    );

    expect(result.map((slide) => slide.kind)).toEqual([
      "welcome",
      "week_map",
      "spark",
      "partial_unlocks",
      "partial_final",
    ]);
    expect(result).toHaveLength(5);
  });

  it("keeps all eight READY screens when optional evidence is absent", () => {
    const result = composeWeeklyRecapSlides(
      review("READY", {
        recap: {
          status: "READY",
          activeDays: 1,
          weeklyTitle: {
            id: "FOCUS_TRAVELER",
            label: "Nova Yolcusu",
            message: "İlk izini bıraktın.",
          },
          nextStorySignal: null,
          nextStorySignals: [],
          closingMessage: "Yanındayım.",
        },
      }),
    );

    expect(result).toHaveLength(8);
    expect(result.map((slide) => slide.kind)).toContain("performance");
    expect(getFocusStoryMode(review("READY"))).toBe("teaser");
    expect(getPerformanceStoryMode(review("READY"))).toBe("curiosity_bridge");
    expect(getWeeklyBestStorySource(review("READY"))).toBe("highlight");
  });

  it("returns no deck for EMPTY", () => {
    expect(composeWeeklyRecapSlides(review("EMPTY"))).toEqual([]);
  });
});

describe("weekly recap evidence presentation", () => {
  it("uses committed Figma exports for every decorative asset", () => {
    expect(WEEKLY_RECAP_FIGMA_ASSETS).toEqual({
      floral: "/visuals/weekly-recap-2023/floral.png",
      graphics: "/visuals/weekly-recap-2023/graphics.png",
      greenShape: "/visuals/weekly-recap-2023/green-shape.png",
      greenWiggle: "/visuals/weekly-recap-2023/green-wiggle.png",
      lavenderPixel: "/visuals/weekly-recap-2023/lavender-pixel.png",
      lavenderShape: "/visuals/weekly-recap-2023/lavender-shape.png",
      redPixel: "/visuals/weekly-recap-2023/red-pixel.png",
      silverWiggle: "/visuals/weekly-recap-2023/silver-wiggle.png",
      worldMap: "/visuals/weekly-recap-2023/world-map.png",
    });
  });

  it("maps the fire mascot video and reveals active days at its flame peak", () => {
    expect(WEEKLY_RECAP_VIDEO_ASSETS.puhuFire).toBe("/video/puhu-fire.mp4");
    expect(getWeeklyRecapWeekMapPhase(2_199)).toBe("headline");
    expect(getWeeklyRecapWeekMapPhase(2_200)).toBe("active_days");
  });

  it("prefers verified focus subject, then plan subject, then highlight", () => {
    const focusReview = review("READY", {
      rhythm: {
        ...review("READY").rhythm,
        subjectBreakdown: [
          {
            subjectRef: "matematik",
            subjectName: "Matematik",
            focusMinutes: 60,
            qualifyingSessionCount: 2,
          },
        ],
      },
    });
    const planReview = review("READY", {
      plan: {
        completedTaskCount: 3,
        subjectBreakdown: [
          {
            subjectRef: "turkce",
            subjectName: "Türkçe",
            completedTaskCount: 3,
          },
        ],
        message: "Plan",
      },
    });

    expect(getWeeklyBestStorySource(focusReview)).toBe("focus_subject");
    expect(getWeeklyBestStorySource(planReview)).toBe("plan_subject");
    expect(getWeeklyBestStorySource(review("READY"))).toBe("highlight");
  });

  it("uses calm teaser modes instead of zero metrics", () => {
    expect(getFocusStoryMode(review("READY"))).toBe("teaser");
    expect(getPerformanceStoryMode(review("READY"))).toBe("curiosity_bridge");

    expect(
      getFocusStoryMode(
        review("READY", {
          rhythm: { ...review("READY").rhythm, focusMinutes: 30 },
        }),
      ),
    ).toBe("data");
    expect(
      getPerformanceStoryMode(
        review("READY", {
          performance: {
            mockExamCount: 1,
            averageNet: "42",
            previousWeekAverageNet: null,
            delta: null,
            evidenceLevel: "EARLY",
            message: "İlk sinyal.",
          },
        }),
      ),
    ).toBe("data");
  });

  it("exposes backend-owned focus-time and peak-day story proof when present", () => {
    const wrappedReview = review("READY", {
      rhythm: {
        ...review("READY").rhythm,
        focusTimeBand: {
          id: "MORNING",
          label: "Sabah modu",
          focusMinutes: 60,
          qualifyingSessionCount: 2,
          message: "Sabah modu başrolü aldı.",
        },
        peakFocusDay: {
          date: "2026-07-14",
          focusMinutes: 45,
          message: "Güç gününde 45 dakika odaklandın.",
        },
      },
    });

    expect(getWeeklyRecapFocusTimeMessage(wrappedReview)).toBe(
      "Sabah modu başrolü aldı.",
    );
    expect(getWeeklyRecapPeakDayStory(wrappedReview, "tr")).toEqual({
      dayLabel: "Salı",
      focusMinutes: 45,
      message: "Güç gününde 45 dakika odaklandın.",
    });
    expect(getWeeklyRecapPeakDayStory(review("READY"), "tr")).toBeNull();
  });
});

describe("weekly recap playback", () => {
  const slides = composeWeeklyRecapSlides(
    review("READY", {
      recap: {
        status: "READY",
        activeDays: 2,
        weeklyTitle: {
          id: "FOCUS_TRAVELER",
          label: "Nova Yolcusu",
          message: "Devam.",
        },
        nextStorySignal: null,
        nextStorySignals: [],
        closingMessage: "Yanındayım.",
      },
    }),
  );

  it("starts playing normally and paused for reduced motion", () => {
    expect(createWeeklyRecapPlayback(false)).toEqual({
      index: 0,
      elapsedMs: 0,
      playing: true,
      completed: false,
    });
    expect(createWeeklyRecapPlayback(true).playing).toBe(false);
  });

  it("advances by elapsed time and stops on the completed final screen", () => {
    const start = createWeeklyRecapPlayback(false);
    const half = advanceWeeklyRecapPlayback(start, 5_000, slides);
    expect(half).toMatchObject({ index: 0, elapsedMs: 5_000, playing: true });

    const next = advanceWeeklyRecapPlayback(half, 5_000, slides);
    expect(next).toMatchObject({ index: 1, elapsedMs: 0, playing: true });

    const complete = advanceWeeklyRecapPlayback(
      start,
      slides.reduce((sum, slide) => sum + slide.durationMs, 0),
      slides,
    );
    expect(complete).toEqual({
      index: slides.length - 1,
      elapsedMs: slides.at(-1)?.durationMs,
      playing: false,
      completed: true,
    });
  });

  it("resets progress on manual navigation and replays from the welcome", () => {
    const progressed = advanceWeeklyRecapPlayback(
      createWeeklyRecapPlayback(false),
      3_000,
      slides,
    );
    expect(navigateWeeklyRecapPlayback(progressed, 3, slides)).toMatchObject({
      index: 3,
      elapsedMs: 0,
      completed: false,
    });
    expect(replayWeeklyRecap()).toEqual(createWeeklyRecapPlayback(false));
  });

  it("advances only while playing, visible and not held", () => {
    expect(
      shouldWeeklyRecapAdvance({
        playing: true,
        pageVisible: true,
        held: false,
      }),
    ).toBe(true);
    expect(
      shouldWeeklyRecapAdvance({
        playing: true,
        pageVisible: false,
        held: false,
      }),
    ).toBe(false);
    expect(
      shouldWeeklyRecapAdvance({
        playing: true,
        pageVisible: true,
        held: true,
      }),
    ).toBe(false);
  });

  it("treats a long press as temporary pause without navigating", () => {
    expect(shouldNavigateAfterWeeklyRecapPress(120)).toBe(true);
    expect(shouldNavigateAfterWeeklyRecapPress(300)).toBe(false);
    expect(shouldNavigateAfterWeeklyRecapPress(850)).toBe(false);
  });

  it("switches story copy from headline to support at the configured beat", () => {
    expect(getWeeklyRecapTextBeat(0, 7_000)).toBe("headline");
    expect(getWeeklyRecapTextBeat(3_149, 7_000)).toBe("headline");
    expect(getWeeklyRecapTextBeat(3_150, 7_000)).toBe("support");
    expect(getWeeklyRecapTextBeat(6_999, 7_000)).toBe("support");
  });
});

describe("weekly recap local storage", () => {
  it("uses the completed week start as a versioned key", () => {
    expect(weeklyRecapOpenedKey("2026-07-13")).toBe(
      "mentor.weekly-recap.opened.v2:2026-07-13",
    );
  });

  it("keeps the current week visible and switches it to replay after opening", () => {
    const getItem = vi.fn(() => null);
    const setItem = vi.fn();
    const storage = { getItem, setItem };

    expect(getWeeklyRecapTeaserState(storage, "2026-07-13")).toBe("new");
    markWeeklyRecapOpened(storage, "2026-07-13");
    expect(setItem).toHaveBeenCalledWith(
      "mentor.weekly-recap.opened.v2:2026-07-13",
      "1",
    );

    getItem.mockReturnValue("1");
    expect(getWeeklyRecapTeaserState(storage, "2026-07-13")).toBe("replay");
  });

  it("never shows the dashboard teaser for an EMPTY completed week", () => {
    const storage = { getItem: vi.fn(() => null) };

    expect(getWeeklyRecapTeaserState(storage, "2026-07-13", "EMPTY")).toBe(
      "hidden",
    );
  });
});

describe("weekly recap privacy and return source", () => {
  it("builds taxonomy-subject sharing copy without private behavioral text", () => {
    const shareReview = review("READY", {
      recap: {
        status: "READY",
        activeDays: 3,
        weeklyTitle: {
          id: "FOCUS_DIVER",
          label: "Nebula Dalgıcı",
          message: "Private title reason",
        },
        nextStorySignal: null,
        nextStorySignals: [],
        closingMessage: "Private mood marker",
      },
      evidence: {
        mockExamCount: 1,
        completedSessionCount: 2,
        qualifyingSessionCount: 2,
        completedPlanTaskCount: 4,
      },
      rhythm: {
        completedSessionCount: 2,
        focusMinutes: 50,
        activeDays: 3,
        longestSessionMinutes: 30,
        longestActiveRun: 2,
        focusTimeBand: null,
        peakFocusDay: null,
        days: [],
        subjectBreakdown: [
          {
            subjectRef: "taxonomy-matematik",
            subjectName: "Matematik",
            focusMinutes: 50,
            qualifyingSessionCount: 2,
          },
        ],
        moodCheckinCount: 1,
        energySignal: "LOW",
        message: "Private mood marker",
      },
      plan: {
        completedTaskCount: 4,
        subjectBreakdown: [
          {
            subjectRef: "private-subject",
            subjectName: "Private task subject marker",
            completedTaskCount: 4,
          },
        ],
        message: "Plan",
      },
      highlights: [],
      performance: {
        mockExamCount: 1,
        averageNet: "SECRET-NET",
        previousWeekAverageNet: null,
        delta: null,
        evidenceLevel: "EARLY",
        message: "Performance",
      },
    });
    const value = buildWeeklyRecapShareText(shareReview, {
      title: "Haftanın Hikâyesi",
      sessions: (count) => `${count} seans`,
      minutes: (count) => `${count} dakika`,
      activeDays: (count) => `${count} aktif gün`,
      completedTasks: (count) => `${count} görev`,
      weeklyTitle: (label) => `Unvanım: ${label}`,
      topSubject: (name, minutes) => `${name}: ${minutes} dakika`,
    });

    expect(value).toBe(
      "Haftanın Hikâyesi · Unvanım: Nebula Dalgıcı · 2 seans · 50 dakika · 3 aktif gün · 4 görev · Matematik: 50 dakika",
    );
    expect(value).not.toMatch(
      /SECRET-NET|Private mood|Private task|private-subject|taxonomy-matematik/i,
    );

    expect(buildWeeklyRecapShareCardModel(shareReview)).toEqual({
      weeklyTitle: "Nebula Dalgıcı",
      characterImageSrc: WEEKLY_RECAP_CHARACTER_IMAGE_ASSETS.nebulaDiver,
      focusMinutes: 50,
      activeDays: 3,
      qualifyingSessionCount: 2,
      completedTaskCount: 4,
      longestSessionMinutes: 30,
      longestActiveRun: 2,
      topSubject: {
        subjectName: "Matematik",
        focusMinutes: 50,
      },
    });

    expect(
      buildWeeklyRecapShareCardRows(
        buildWeeklyRecapShareCardModel(shareReview),
        {
          focus: "Gerçek odak",
          activeDays: "Aktif gün",
          sessions: "Odak seansı",
          completedTasks: "Tamamlanan görev",
          longestSession: "En uzun seans",
          longestRun: "En uzun ritim",
          topSubject: "En çok çalışılan ders",
          minutes: (count) => `${count} dk`,
          days: (count) => `${count} gün`,
          count: (count) => String(count),
          subject: (name, minutes) => `${name} · ${minutes} dk`,
        },
      ),
    ).toEqual([
      { label: "Gerçek odak", value: "50 dk" },
      { label: "Aktif gün", value: "3" },
      { label: "Odak seansı", value: "2" },
      { label: "Tamamlanan görev", value: "4" },
      { label: "En uzun seans", value: "30 dk" },
      { label: "En uzun ritim", value: "2 gün" },
      {
        label: "En çok çalışılan ders",
        value: "Matematik · 50 dk",
      },
    ]);
  });

  it("returns to the surface that opened the story", () => {
    expect(weeklyRecapExitHref("dashboard")).toBe("/dashboard");
    expect(weeklyRecapExitHref("analysis")).toEqual({
      pathname: "/analysis",
      query: { tab: "progress" },
    });
  });

  it("opens the existing story route from the fully clickable teaser", () => {
    expect(
      buildWeeklyRecapTeaserHref({
        source: "dashboard",
        examId: "exam-1",
        examType: "KPSS",
      }),
    ).toEqual({
      pathname: "/analysis/recap",
      query: {
        source: "dashboard",
        examId: "exam-1",
        examType: "KPSS",
      },
    });
    expect(buildWeeklyRecapTeaserHref({ source: "analysis" })).toEqual({
      pathname: "/analysis/recap",
      query: { source: "analysis" },
    });
  });
});
