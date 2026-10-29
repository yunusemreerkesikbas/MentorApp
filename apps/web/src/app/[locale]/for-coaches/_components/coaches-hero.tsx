import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { LEDGE } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { FACADE, FAR, MID, type SceneArt } from "../../_components/landing/city-scene";
import { LEDGE_ON_PAPER } from "../../_components/landing/landing-paper";
import { SceneImg } from "../../_components/landing/scene-img";

export const LEDGE_COACH = `${LEDGE} bg-[var(--kc-coach)] text-[var(--landing-on-night)] shadow-[0_4px_0_var(--kc-coach-edge)]`;

/** Canvas layer px (box origin at world x = -400) → % of the 1600×1000 world box. */
function at(left: number, top: number): CSSProperties {
  return { left: `${(left - 400) / 16}%`, top: `${top / 10}%` };
}

function art(scene: SceneArt): CSSProperties {
  return { ...at(scene.left, scene.top), width: `${scene.width / 16}%` };
}

type Tag = { name: string; key: "sessions" | "quiet" | "plan_done" | "plan_slipped" | "mock" | "seat"; count?: number; left: number; top: number; tilt: string };

/** Last night on each flat, as the coach's tags on the glass (Mert's dark window: three quiet days). */
const TAGS: Tag[] = [
  { name: "Ayşe", key: "sessions", count: 2, left: 940, top: 446, tilt: "-2deg" },
  { name: "Mert", key: "quiet", count: 3, left: 1124, top: 446, tilt: "2deg" },
  { name: "Zeynep", key: "sessions", count: 1, left: 1315, top: 446, tilt: "-1deg" },
  { name: "Elif", key: "plan_done", left: 940, top: 683, tilt: "1.5deg" },
  { name: "", key: "seat", left: 1124, top: 683, tilt: "0deg" },
  { name: "Deniz", key: "sessions", count: 3, left: 1315, top: 683, tilt: "-2deg" },
  { name: "Can", key: "plan_slipped", left: 940, top: 930, tilt: "-1.5deg" },
  { name: "Selin", key: "mock", left: 1315, top: 930, tilt: "2deg" },
];

const FLAGGED = new Set<Tag["key"]>(["quiet", "plan_slipped"]);

/** 07:00, the same apartment as the landing: who studied last night, hung on the windows. */
export async function CoachesHero({ signupOpen }: { signupOpen: boolean }) {
  const [t, landing] = await Promise.all([getTranslations("coaches"), getTranslations("landing")]);
  return (
    <section className="kc-hero" aria-labelledby="coaches-title">
      <div className="kc-stage" aria-hidden="true">
        <div className="kc-sun" />
        <div className="kc-world">
          <SceneImg className="kc-art" src={FAR.src} style={art(FAR)} />
          <SceneImg className="kc-art" src={MID.src} style={art(MID)} />
          <SceneImg className="kc-art" src={FACADE.src} style={art(FACADE)} fetchPriority="high" />
          <div className="kc-dim" style={{ ...at(948, 812), width: `${134 / 16}%`, height: `${127 / 10}%` }} />
          {TAGS.map((tag) => (
            <p
              key={`${tag.left}-${tag.top}`}
              className={`kc-tag${tag.key === "seat" ? " is-seat" : FLAGGED.has(tag.key) ? " is-flag" : ""}`}
              style={{ ...at(tag.left, tag.top), "--r": tag.tilt } as CSSProperties}
            >
              {tag.key === "seat" ? (
                <span>
                  + <small>{t("tag_seat")}</small>
                </span>
              ) : (
                <>
                  <i>{FLAGGED.has(tag.key) ? "!" : "✓"}</i>
                  <span>
                    {tag.name} <small>{t(`tag_${tag.key}`, { count: tag.count ?? 0 })}</small>
                  </span>
                </>
              )}
            </p>
          ))}
        </div>
        <div className="kc-scrim" />
      </div>
      <div className="kc-copy">
        <p className="kc-pill">{t("pill")}</p>
        <h1 id="coaches-title">{t.rich("title", { em: (chunks) => <em>{chunks}</em> })}</h1>
        <p className="kc-lead">{t("lead")}</p>
        <div className="flex flex-wrap gap-3">
          {signupOpen ? (
            <Link href={{ pathname: "/signup", query: { rol: "koc" } }} className={`${LEDGE_COACH} max-lg:w-full`}>
              {t("cta")}
            </Link>
          ) : null}
          <Link href="/login" className={`${LEDGE} ${LEDGE_ON_PAPER} max-lg:w-full`}>
            {landing("has_account")}
          </Link>
        </div>
        <p className="kc-free">
          <i aria-hidden="true">✓</i>
          {t("free")}
        </p>
        <ul className="kc-summary" aria-label={t("summary_label")}>
          <li>{t("summary1")}</li>
          <li>{t("summary2")}</li>
          <li>{t("summary3")}</li>
        </ul>
      </div>
    </section>
  );
}
