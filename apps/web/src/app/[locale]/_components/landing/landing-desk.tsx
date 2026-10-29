import { getTranslations } from "next-intl/server";
import { HungDeskBoard } from "./desk-board";
import { DeskPicker, type DeskItem } from "./desk-picker";
import { DeskScene, type DeskSceneCopy } from "./desk-scene";
import { StoryFan } from "./desk-story";
import { PAGE_FRAME, PAPER_PILL, PAPER_TITLE } from "./landing-paper";
import "./landing-desk.css";

/**
 * "Sabah masası": right after the dawn, the three things the night story never showed, on the
 * app's own Defterlerim desk: the mistake notebook, the goal board and the story of the week.
 * The demo speaks the app's own words (`notebooks.*`, `notebook.*`, `vision.*`, `analysis.recap.*`);
 * only the sample contents (a goal, a city, a week's numbers) are landing copy. Free features only:
 * no AI is shown, so nothing here says Premium (docs/copy/voice.md, Landing).
 */
export async function LandingDesk() {
  // `landing.morning`: `landing.desk` is the city's own desk stop.
  const [t, d] = await Promise.all([getTranslations(), getTranslations("landing.morning")]);

  const board = { goal: d("board.goal"), city: d("board.city") };
  const story = {
    welcome: t("analysis.recap.welcome.title"),
    dates: d("story.dates"),
    focusTitle: t("analysis.recap.focus.title"),
    focusMinutes: t("analysis.recap.focus.minutes"),
    runTitle: t("analysis.recap.weekly_run.title", { count: 4 }),
    codenameLabel: t("analysis.recap.weekly_title.label"),
    codename: d("story.codename"),
  };
  const scene: DeskSceneCopy = {
    bubble: t("notebooks.desk.bubble_due", { time: "day", count: 2 }),
    mistakeTitle: t("notebook.cover_title"),
    mistakePages: t("notebooks.pages", { count: 11 }),
    due: t("notebooks.due", { count: 2 }),
    mathTitle: d("notebook.math"),
    mathPages: t("notebooks.pages", { count: 1 }),
    mathTape: d("notebook.math_tape"),
    newNotebook: t("notebooks.create"),
    board,
    story,
  };

  const items: DeskItem[] = [
    {
      name: d("notebook.name"),
      tab: d("notebook.tab"),
      pin: { x: 384, y: 276 },
      paper: "lined",
      tilt: "-0.8deg",
      tape: "#f7b3a0",
      note: (
        <>
          <h3>{d("notebook.title")}</h3>
          <p className="ld-body">{d("notebook.body")}</p>
          {/* The review deck as the app deals it: a card per question, answered with one tap. */}
          <div className="ld-mini ld-review" aria-hidden="true">
            <span className="ld-review-top">
              <span className="ld-due">{t("notebook.due_strip", { count: 3 })}</span>
              <span className="ld-review-count">1 / 3</span>
            </span>
            <span className="ld-deck">
              <span className="ld-card is-back is-2">
                <span className="ld-card-subject">{d("notebook.subject_history")}</span>
              </span>
              <span className="ld-card is-back is-1">
                <span className="ld-card-subject">{d("notebook.subject_turkish")}</span>
              </span>
              <span className="ld-card is-front">
                <span className="ld-card-paper">
                  <span className="ld-q">{d("notebook.question")}</span>
                  <span className="ld-q-options">
                    <span>A) 7</span>
                    <span>B) 8</span>
                    <span className="is-circled">C) 9</span>
                    <span>D) 10</span>
                  </span>
                  <span className="ld-q-hand">x = 9</span>
                </span>
                <span className="ld-card-subject">{d("notebook.math_tape")}</span>
              </span>
            </span>
            <span className="ld-review-ask">{t("notebook.review_question")}</span>
            <span className="ld-review-actions">
              <span className="ld-answer is-missed">
                <i>
                  <svg viewBox="0 0 24 24">
                    <path d="M7 7l10 10M17 7 7 17" />
                  </svg>
                </i>
                {t("notebook.review_missed_short")}
              </span>
              <span className="ld-answer is-solved">
                <i>
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </i>
                {t("notebook.review_solved_short")}
              </span>
            </span>
          </div>
        </>
      ),
    },
    {
      name: d("board.name"),
      tab: d("board.tab"),
      pin: { x: 686, y: 44 },
      tilt: "0.6deg",
      tape: "#a8d8b0",
      note: (
        <>
          <h3>{d("board.title")}</h3>
          <p className="ld-body">{d("board.body")}</p>
          <div className="ld-mini" aria-hidden="true">
            <HungDeskBoard {...board} />
            <span className="ld-board-actions">
              <span>{t("vision.board.share_format_wallpaper")}</span>
              <span className="is-share">{t("vision.board.share")}</span>
            </span>
          </div>
        </>
      ),
    },
    {
      name: d("story.name"),
      tab: d("story.tab"),
      pin: { x: 702, y: 240 },
      paper: "grid",
      tilt: "-0.5deg",
      tape: "#cbb8f0",
      note: (
        <>
          <h3>{d("story.title")}</h3>
          <p className="ld-body">{d("story.body")}</p>
          <StoryFan copy={story} />
        </>
      ),
    },
  ];

  return (
    <section id="sabah" aria-labelledby="landing-desk-title" className={`ld-root ${PAGE_FRAME} scroll-mt-24 pt-16 lg:pt-24`}>
      <div className="max-w-3xl">
        <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>{d("pill")}</p>
        <h2 id="landing-desk-title" className={PAPER_TITLE}>
          {d("title")}
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-[var(--landing-ink-soft)]">{d("lead")}</p>
      </div>
      <DeskPicker scene={<DeskScene copy={scene} />} items={items} />
    </section>
  );
}
