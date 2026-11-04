import { getTranslations } from "next-intl/server";
import { Chart2Icon } from "@solar-icons/react/bold/chart-2";
import { ChatRoundDotsIcon } from "@solar-icons/react/bold/chat-round-dots";
import { ClipboardCheckIcon } from "@solar-icons/react/bold/clipboard-check";
import { ForbiddenIcon } from "@solar-icons/react/bold/forbidden";
import { NotebookIcon } from "@solar-icons/react/bold/notebook";
import { PlayCircleIcon } from "@solar-icons/react/bold/play-circle";
import { Sun2Icon } from "@solar-icons/react/bold/sun-2";
import { LEDGE } from "@/components/panel/panel-styles";
import { PREMIUM_MASK_PATH } from "@/components/premium/premium-mask";
import { Link } from "@/i18n/navigation";
import { landingAvailability } from "./landing-availability";
import { PAGE_FRAME, PAPER_PILL, PAPER_TITLE } from "./landing-paper";
import { PremiumFlightVideo } from "./premium-flight-video";
import { SceneImg } from "./scene-img";
import "./landing-premium.css";

/**
 * "Premium": the night over the city once more, with Premium Puhu flying on the left and what
 * Premium adds on the right. Only while the AI coach and student purchases are both on; an unknown
 * availability reads as off, so the landing never offers a trial nobody can start.
 *
 * Every row is something Premium opens on the web today: the paywall's coach, daily, analysis,
 * notebook and ad-free rows, plus "Koçla planla" and the weekly story (both Coin or Premium). The
 * weekly chest is not here: everyone gets it, Premium only turns its Coin into XP. "7 gün" is fixed
 * copy of the plan catalog's default `trial_days`: change them together.
 */
const BENEFITS = [
  { key: "chat", Icon: ChatRoundDotsIcon },
  { key: "daily", Icon: Sun2Icon },
  { key: "plan", Icon: ClipboardCheckIcon },
  { key: "analysis", Icon: Chart2Icon },
  { key: "story", Icon: PlayCircleIcon },
  { key: "notebook", Icon: NotebookIcon },
  { key: "adfree", Icon: ForbiddenIcon },
] as const;

export async function LandingPremium() {
  const [p, availability] = await Promise.all([getTranslations("landing.premium"), landingAvailability()]);
  if (availability?.aiCoach !== true || availability.studentPurchases !== true) return null;

  return (
    <section id="premium" aria-labelledby="landing-premium-title" className="lp-root scroll-mt-24">
      <div aria-hidden="true" className="lp-sky">
        <div className="lp-stars" />
        <SceneImg src="/visuals/landing/city-far.webp" className="lp-city lp-city-far" loading="lazy" />
        <SceneImg src="/visuals/landing/city-mid.webp" className="lp-city lp-city-mid" loading="lazy" />
        <SceneImg src="/visuals/landing/city-front.webp" className="lp-city lp-city-front" loading="lazy" />
      </div>

      <div className={`${PAGE_FRAME} lp-inner`}>
        <div aria-hidden="true" className="lp-art">
          <PremiumFlightVideo />
        </div>

        <div className="lp-copy">
          <p className={`${PAPER_PILL} lp-pill`}>
            <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" focusable="false">
              <path fill="currentColor" fillRule="evenodd" d={PREMIUM_MASK_PATH} />
            </svg>
            {p("pill")}
          </p>
          <h2 id="landing-premium-title" className={PAPER_TITLE}>
            {p.rich("title", { lit: (chunks) => <span className="lp-lit">{chunks}</span> })}
          </h2>
          <p className="lp-lead">{p("lead")}</p>

          <ul className="lp-benefits">
            {BENEFITS.map(({ key, Icon }) => (
              <li key={key}>
                <Icon size={24} aria-hidden="true" />
                {p(`benefit.${key}`)}
              </li>
            ))}
          </ul>

          <Link href="/welcome" className={`${LEDGE} lp-cta max-sm:w-full`}>
            {p("cta")}
          </Link>
          <p className="lp-note">{p("cancel")}</p>
        </div>
      </div>
    </section>
  );
}
