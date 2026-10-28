import type { CSSProperties, ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { LEDGE } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { LEDGE_ON_PAPER, PAGE_FRAME, PAPER_TITLE } from "../../_components/landing/landing-paper";
import { LEDGE_COACH } from "./coaches-hero";

/** Last 14 days of Mert's minutes (% of the strip); the last three are the quiet days. */
const STRIP = [40, 55, 0, 70, 62, 84, 0, 48, 58, 45, 30, 0, 0, 0];

function Step({ id, flip, time, title, body, tilt, children }: {
  id?: string;
  flip?: boolean;
  time: string;
  title: string;
  body: string;
  tilt: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`kc-step scroll-mt-24${flip ? " is-flip" : ""}`}>
      <div className="kc-step-copy">
        <span className="kc-time" aria-hidden="true">
          {time}
        </span>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div className="kc-board" style={{ "--tilt": tilt } as CSSProperties}>
        <div className="kc-sheet">{children}</div>
      </div>
    </section>
  );
}

function SheetTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <p className="kc-sheet-title">
      {title} <small>{hint}</small>
    </p>
  );
}

/** A coach's morning, 07:30 to 08:30: each step is a clipboard with the real screen's look. */
export async function CoachesRound() {
  const t = await getTranslations("coaches");
  const days = t("plan.days").split(",");
  return (
    <div className={PAGE_FRAME}>
      <Step id="tur" time={t("round.time")} title={t("round.title")} body={t("round.body")} tilt="-1deg">
        <SheetTitle title={t("round.sheet")} hint={t("round.waiting")} />
        <ol className="kc-round" aria-label={t("round.label")}>
          <li className="is-done"><b>✓</b>Ayşe</li>
          <li className="is-next"><b>M</b>Mert<small>{t("tag_quiet", { count: 3 })}</small></li>
          <li><b>C</b>Can<small>{t("tag_plan_slipped")}</small></li>
          <li><b>+2</b>{t("round.others")}</li>
          <li className="is-end"><b>★</b>{t("round.done")}</li>
        </ol>
        <span className="kc-fake-btn" aria-hidden="true">{t("round.action")}</span>
      </Step>

      <Step flip time={t("week.time")} title={t("week.title")} body={t("week.body")} tilt=".8deg">
        <SheetTitle title="Mert" hint={t("week.span")} />
        <div className="kc-strip" role="img" aria-label={t("week.strip_label")}>
          {STRIP.map((h, i) => (
            <i key={i} className={h === 0 ? "is-zero" : undefined} style={{ height: `${h === 0 ? 5 : h}%` }} />
          ))}
        </div>
        <p className="kc-facts">
          <span><b>6</b>{t("week.streak")}</span>
          <span><b>68</b>{t("week.net")}</span>
          <span><b>%72</b>{t("week.plan_rate")}</span>
        </p>
        <p className="kc-mood">{t.rich("week.mood", { em: (chunks) => <em>{chunks}</em> })}</p>
      </Step>

      <Step time={t("plan.time")} title={t("plan.title")} body={t("plan.body")} tilt="-.6deg">
        <SheetTitle title={t("plan.sheet")} hint={t("plan.draft")} />
        <div className="kc-week">
          <div><b>{days[0]}</b><span className="kc-task is-blue">{t("plan.task_turkish")}</span><span className="kc-task is-yellow">{t("plan.task_review")}</span></div>
          <div><b>{days[1]}</b><span className="kc-task is-green">{t("plan.task_math")}</span></div>
          <div><b>{days[2]}</b><span className="kc-task is-blue">{t("plan.task_reading")}</span><span className="kc-task is-coral">{t("plan.task_mock")}</span></div>
          <div><b>{days[3]}</b><span className="kc-task is-green">{t("plan.task_geometry")}</span></div>
          <div><b>{days[4]}</b><span className="kc-task is-add">{t("plan.task_add")}</span></div>
        </div>
        <div className="kc-actions" aria-hidden="true">
          <span className="kc-fake-btn">{t("plan.send")}</span>
          <span className="kc-ai">✦ {t("plan.ai")}</span>
        </div>
      </Step>

      <Step flip time={t("trust.time")} title={t("trust.title")} body={t("trust.body")} tilt=".7deg">
        <div className="kc-trust">
          <div className="kc-col">
            <p className="kc-col-label">{t("trust.theirs")}</p>
            <div className="kc-bubble" aria-hidden="true"><i style={{ width: "90%" }} /><i style={{ width: "70%" }} /></div>
            <div className="kc-bubble is-mine" aria-hidden="true"><i style={{ width: "85%" }} /><i style={{ width: "55%" }} /></div>
            <div className="kc-bubble" aria-hidden="true"><i style={{ width: "75%" }} /></div>
            <p className="kc-lock">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              {t("trust.lock")}
            </p>
          </div>
          <div className="kc-col">
            <p className="kc-col-label">{t("trust.yours")}</p>
            <ul className="kc-signals">
              <li>{t("trust.signal1")}</li>
              <li>{t("trust.signal2")}</li>
              <li className="is-ok">{t("trust.signal3")}</li>
            </ul>
          </div>
        </div>
      </Step>

      <Step time={t("invite.time")} title={t("invite.title")} body={t("invite.body")} tilt="-.8deg">
        <SheetTitle title={t("invite.sheet")} hint={t("invite.hint")} />
        <div className="kc-code">
          <b>K7Q2-9M</b>
          <span className="kc-fake-btn is-line" aria-hidden="true">{t("invite.copy")}</span>
        </div>
        <ol className="kc-steps">
          <li><b>1</b>{t("invite.step1")}</li>
          <li><b>2</b>{t("invite.step2")}</li>
          <li><b>3</b>{t("invite.step3")}</li>
        </ol>
        <p className="kc-seats">
          <span className="kc-seat is-on" aria-hidden="true">A</span>
          <span className="kc-seat is-on" aria-hidden="true">M</span>
          <span className="kc-seat" aria-hidden="true">+</span>
          <em>{t("invite.seats")}</em>
        </p>
      </Step>
    </div>
  );
}

/** "Sabah turun hazır.": the round ticked off, and the way in. */
export async function CoachesFinal({ signupOpen }: { signupOpen: boolean }) {
  const [t, landing] = await Promise.all([getTranslations("coaches"), getTranslations("landing")]);
  return (
    <section aria-labelledby="coaches-final-title" className={`${PAGE_FRAME} flex flex-col items-center pb-24 pt-16 text-center`}>
      <div className="kc-board kc-final-board" style={{ "--tilt": "-1.2deg" } as CSSProperties} aria-hidden="true">
        <div className="kc-sheet">
          <ul className="kc-done">
            <li><b>✓</b>Ayşe</li>
            <li><b>✓</b>Mert</li>
            <li><b>✓</b>Can</li>
            <li className="is-star">{t("final.done")} ★</li>
          </ul>
        </div>
      </div>
      <h2 id="coaches-final-title" className={`${PAPER_TITLE} mt-8`}>
        {t("final.title")}
      </h2>
      <p className="mt-3 text-lg text-[var(--landing-ink-soft)]">{t("final.body")}</p>
      <div className="mt-7 flex w-full flex-wrap justify-center gap-3">
        {signupOpen ? (
          <Link href={{ pathname: "/signup", query: { rol: "koc" } }} className={`${LEDGE_COACH} max-sm:w-full`}>
            {t("cta")}
          </Link>
        ) : null}
        <Link href="/login" className={`${LEDGE} ${LEDGE_ON_PAPER} max-sm:w-full`}>
          {landing("has_account")}
        </Link>
      </div>
    </section>
  );
}
