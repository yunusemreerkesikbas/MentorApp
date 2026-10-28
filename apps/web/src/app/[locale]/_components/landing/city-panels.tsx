import { Suspense, type CSSProperties, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { CAREER_GROUPS } from "@mentor/types";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { AskPuhuDemo } from "./ask-puhu-demo";
import { CareerPicker, type CareerChoice } from "./career-picker";
import type { CityBell } from "./city-stage";
import { BELLS } from "./city-scene";
import { LandingCounter } from "./landing-counter";

type Translate = Awaited<ReturnType<typeof getTranslations>>;

const LEDGE_ON_NIGHT = "border-2 border-[var(--landing-on-night-line)] text-[var(--landing-on-night)]";

const ARROW = (
  <svg width="60" height="30" viewBox="0 0 60 30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 6c12 16 30 20 48 12" />
    <path d="M43 11l10 7-12 4" />
  </svg>
);

const CLIP = (
  <svg className="lc-clip" width="18" height="46" viewBox="0 0 18 46" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M5 16v20a4 4 0 0 0 8 0V9a6 6 0 0 0-12 0v26" />
  </svg>
);

function Icon({ d, fill }: { d: string[]; fill?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

interface NoteProps {
  name: string;
  /** Left out when an island inside draws its own heading (the career picker changes it). */
  title?: string;
  body?: string;
  /** The coach's chips need the room on a phone. */
  bodyOnPhone?: boolean;
  scribble?: string;
  scribbleAbove?: boolean;
  paper?: "lined" | "grid";
  tilt: string;
  tape: string;
  /** "No 4": the flat number on the door plate, numbered as the facade reads. */
  plateLabel: string;
  children?: ReactNode;
}

/** A paper note fallen from the window: tape, the flat's door plate, a margin scribble towards the glass. */
function Note({ name, title, body, bodyOnPhone = true, scribble, scribbleAbove, paper, tilt, tape, plateLabel, children }: NoteProps) {
  const style = { "--tilt": tilt, "--tape": tape } as CSSProperties;
  return (
    <>
      <div className={`lc-sheet lc-note${paper ? ` is-${paper}` : ""}`} style={style}>
        <i className="lc-tape" aria-hidden="true" />
        <p className="lc-plate">
          <b>{plateLabel}</b>
          <span>{name}</span>
        </p>
        {title ? <h2>{title}</h2> : null}
        {body ? <p className={bodyOnPhone ? "lc-body" : "lc-body max-lg:hidden"}>{body}</p> : null}
        {children}
      </div>
      {scribble ? (
        <div className={`lc-scribble${scribbleAbove ? " is-above" : ""}`} aria-hidden="true">
          <span>{scribble}</span>
          {ARROW}
        </div>
      ) : null}
    </>
  );
}

function Hero({ t }: { t: Translate }) {
  return (
    <div className="lc-sheet lc-hero">
      <p className="lc-eyebrow">{t("tagline")}</p>
      <h1 id="landing-title">
        {t.rich("hero_title", { glow: (chunks) => <span className="lc-glow">{chunks}</span> })}
      </h1>
      <p className="lc-lead">{t("hero_lead")}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/welcome" className={`${LEDGE} ${LEDGE_FILLED} max-lg:w-full`}>
          {t("start")}
        </Link>
        <Link href="/login" className={`${LEDGE} ${LEDGE_ON_NIGHT} max-lg:hidden`}>
          {t("has_account")}
        </Link>
      </div>
      <Suspense fallback={null}>
        <LandingCounter />
      </Suspense>
      <p className="lc-links">
        <Link href="/login" className="lc-text-link">
          {t("has_account")}
        </Link>
        <span aria-hidden="true">·</span>
        <a href="#durak-7" className="lc-text-link">
          {t("skip_story")}
        </a>
      </p>
      <p className="lc-hint">
        <Icon d={["M6 9l6 6 6-6"]} />
        {t("scroll_hint")}
        <span aria-hidden="true">·</span>
        <a href="#durak-7" className="lc-text-link">
          {t("skip_story")}
        </a>
      </p>
    </div>
  );
}

/** Everything the scene shows, rendered on the server so the whole story is in the HTML. */
export async function cityStageContent(): Promise<{
  panels: ReactNode[];
  bells: CityBell[];
  intercomTitle: string;
  intercomLabel: string;
}> {
  const [t, career] = await Promise.all([getTranslations("landing"), getTranslations("vision.career")]);
  const plate = (no: number) => t("plate", { no });
  const feelings = ([1, 2, 3] as const).map((i) => ({
    chip: t(`coach.feeling${i}`),
    reply: t(`coach.reply${i}`),
    step: t(`coach.step${i}`),
  }));
  const careerChoices: CareerChoice[] = [
    ...CAREER_GROUPS.map((key) => {
      const label = career(`group.${key}`);
      return { key, label, line: t("yours.line", { field: label }) };
    }),
    { key: "none", label: career("none"), line: t("yours.none_line") },
  ];

  const panels: ReactNode[] = [
    <Hero key="hero" t={t} />,
    <Note key="puhu" plateLabel={plate(1)} name={t("puhu.name")} title={t("puhu.title")} body={t("puhu.body")} scribble={t("puhu.scribble")} paper="lined" tilt="-1deg" tape="#9cc7f0" />,
    <Note key="coach" plateLabel={plate(3)} name={t("coach.name")} title={t("coach.title")} body={t("coach.body")} bodyOnPhone={false} scribble={t("coach.scribble")} tilt=".6deg" tape="#ffe08a">
      <AskPuhuDemo feelings={feelings} groupLabel={t("coach.feelings_label")} empty={t("coach.empty")} note={t("coach.demo_note")} />
    </Note>,
    <Note key="plan" plateLabel={plate(4)} name={t("plan.name")} title={t("plan.title")} body={t("plan.body")} scribble={t("plan.scribble")} tilt="-.6deg" tape="#f7b3a0">
      <div className="lc-mini">
        {CLIP}
        <div className="lc-nodes">
          <div className="lc-node is-done">
            <b><Icon d={["M5 12l5 5L20 7"]} /></b>
            {t("plan.step1")}<br />{t("plan.step1_time")}
          </div>
          <div className="lc-node is-now">
            <b><Icon d={["M8 5v14l11-7z"]} fill /></b>
            {t("plan.step2")}<br />{t("plan.step2_time")}
          </div>
          <div className="lc-node">
            <b><Icon d={["M17 2l4 4-4 4", "M3 11V9a3 3 0 0 1 3-3h15", "M7 22l-4-4 4-4", "M21 13v2a3 3 0 0 1-3 3H3"]} /></b>
            {t("plan.step3")}<br />{t("plan.step3_time")}
          </div>
          <div className="lc-node">
            <b><Icon d={["M3 10h18v10H3z", "M3 10a9 5 0 0 1 18 0", "M12 13v3"]} /></b>
            {t("plan.step4")}<br />{t("plan.step4_time")}
          </div>
        </div>
      </div>
    </Note>,
    <Note key="desk" plateLabel={plate(6)} name={t("desk.name")} title={t("desk.title")} body={t("desk.body")} scribble={t("desk.scribble")} paper="lined" tilt=".9deg" tape="#a8d8b0">
      <div className="lc-mini">
        {CLIP}
        <div className="lc-seats">
          <div className="lc-seat"><b style={{ background: "#ffe3b0" }}>E</b><span>{t("desk.seat1")}<small>{t("desk.seat1_state")}</small></span></div>
          <div className="lc-seat"><b style={{ background: "#d6e8fb" }}>M</b><span>{t("desk.seat2")}<small>{t("desk.seat2_state")}</small></span></div>
          <div className="lc-seat is-me"><b style={{ background: "var(--play-cta)" }}>S</b><span>{t("desk.seat_me")}<small>{t("desk.seat_me_state")}</small></span></div>
          <div className="lc-seat is-empty"><b style={{ background: "#eef2f8" }}>+</b><span>{t("desk.seat_empty")}<small>{t("desk.seat_empty_state")}</small></span></div>
        </div>
      </div>
    </Note>,
    <Note key="community" plateLabel={plate(7)} name={t("community.name")} title={t("community.title")} body={t("community.body")} scribble={t("community.scribble")} tilt="-.7deg" tape="#cbb8f0">
      <div className="lc-mini">
        {CLIP}
        <p className="lc-cheer">{t("community.cheer")}</p>
        <p className="lc-row"><span>1</span><span>{t("community.row1")}</span><span>{t("community.row1_xp")}</span></p>
        <p className="lc-row is-me"><span>2</span><span>{t("community.row_me")}</span><span>{t("community.row_me_xp")}</span></p>
        <p className="lc-row"><span>3</span><span>{t("community.row3")}</span><span>{t("community.row3_xp")}</span></p>
      </div>
    </Note>,
    <Note key="analysis" plateLabel={plate(8)} name={t("analysis.name")} title={t("analysis.title")} body={t("analysis.body")} scribble={t("analysis.scribble")} paper="grid" tilt=".7deg" tape="#9cc7f0">
      <div className="lc-mini">
        {CLIP}
        <div className="lc-bars" aria-hidden="true">
          <i style={{ height: "45%" }} />
          <i style={{ height: "60%" }} />
          <i className="is-dip" style={{ height: "52%" }} />
          <i className="is-now" style={{ height: "78%" }} />
        </div>
        <p className="lc-story">{t("analysis.story")}</p>
      </div>
    </Note>,
    <Note key="yours" plateLabel={plate(2)} name={t("yours.name")} scribble={t("yours.scribble")} scribbleAbove tilt="-.5deg" tape="#ffe08a">
      <CareerPicker
        choices={careerChoices}
        groupLabel={t("yours.choose_label")}
        emptyTitle={t("yours.title")}
        emptyBody={t("yours.body")}
        litTitle={t("yours.lit_title")}
        cta={t("yours.cta")}
      />
    </Note>,
    <div key="dawn" className="lc-sheet lc-dawn">
      <h2>{t("dawn.title")}</h2>
      <p className="lc-body">{t("dawn.body")}</p>
      <div className="mt-6 flex justify-center">
        <Link href="/welcome" className={`${LEDGE} ${LEDGE_FILLED} max-lg:w-full`}>
          {t("start")}
        </Link>
      </div>
    </div>,
  ];

  const bells = BELLS.map(({ no, key, stop }) => {
    const name = t(`${key}.name`);
    return { no, name, stop, label: t("bell_label", { no, name }) };
  });

  return { panels, bells, intercomTitle: t("intercom_title"), intercomLabel: t("intercom_label") };
}
