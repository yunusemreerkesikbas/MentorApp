/**
 * Brand art, imported straight from the web app's public folder so there is one copy of every
 * image in the repo. Metro already watches the monorepo root (`metro.config.js`), and only the
 * files named here end up in the bundle.
 *
 * ponytail: the mood faces are web-sized originals (up to ~0.9 MB for a 28dp glyph). Fine in
 * development; export phone-sized copies before the first store build.
 */
import type { AchievementId, CareerGroup, JourneyLevelKey } from "@mentor/types";
import achDreamSpaceCreated from "../../../web/public/achievements/puhu/dream_space_created.webp";
import achFirstHello from "../../../web/public/achievements/puhu/first_hello.webp";
import achFirstStep from "../../../web/public/achievements/puhu/first_step.webp";
import achHelpedSomeone from "../../../web/public/achievements/puhu/helped_someone.webp";
import achMistakeRevisited from "../../../web/public/achievements/puhu/mistake_revisited.webp";
import achReturnedToPath from "../../../web/public/achievements/puhu/returned_to_path.webp";
import achRhythmFound from "../../../web/public/achievements/puhu/rhythm_found.webp";
import achRhythmKept from "../../../web/public/achievements/puhu/rhythm_kept.webp";
import achRouteDrawn from "../../../web/public/achievements/puhu/route_drawn.webp";
import achRouteRenewed from "../../../web/public/achievements/puhu/route_renewed.webp";
import achStartingPointSet from "../../../web/public/achievements/puhu/starting_point_set.webp";
import achWeekReflected from "../../../web/public/achievements/puhu/week_reflected.webp";
import levelCompass from "../../../web/public/img/levels/compass.webp";
import levelConstellation from "../../../web/public/img/levels/constellation.webp";
import levelCycle from "../../../web/public/img/levels/cycle.webp";
import levelFlow from "../../../web/public/img/levels/flow.webp";
import levelHorizon from "../../../web/public/img/levels/horizon.webp";
import levelLantern from "../../../web/public/img/levels/lantern.webp";
import levelRhythm from "../../../web/public/img/levels/rhythm.webp";
import levelRoot from "../../../web/public/img/levels/root.webp";
import levelSpark from "../../../web/public/img/levels/spark.webp";
import levelStar from "../../../web/public/img/levels/star.webp";
import levelTrail from "../../../web/public/img/levels/trail.webp";
import levelWing from "../../../web/public/img/levels/wing.webp";
import moodBalanced from "../../../web/public/img/balanced.png";
import moodDraining from "../../../web/public/img/draining.png";
import flame from "../../../web/public/img/flame.png";
import moodGood from "../../../web/public/img/good.png";
import moodLow from "../../../web/public/img/low.png";
import moodGreat from "../../../web/public/img/very-good.png";
import careerEgitim from "../../../web/public/mascot/career/egitim.png";
import careerFen from "../../../web/public/mascot/career/fen.png";
import careerHukukKamu from "../../../web/public/mascot/career/hukuk_kamu.png";
import careerIsletme from "../../../web/public/mascot/career/isletme.png";
import careerMimarlik from "../../../web/public/mascot/career/mimarlik.png";
import careerMuhendislik from "../../../web/public/mascot/career/muhendislik.png";
import careerSaglik from "../../../web/public/mascot/career/saglik.png";
import careerSanatTasarim from "../../../web/public/mascot/career/sanat_tasarim.png";
import careerSosyalIletisim from "../../../web/public/mascot/career/sosyal_iletisim.png";
import careerYazilim from "../../../web/public/mascot/career/yazilim.png";
import lampShade from "../../../web/public/mascot/puhu/lamp/lamp-shade.png";
import puhuLampReach from "../../../web/public/mascot/puhu/lamp/puhu-lamp-reach.png";
import puhuLampRest from "../../../web/public/mascot/puhu/lamp/puhu-lamp-rest.png";
import puhuDefault from "../../../web/public/mascot/puhu/puhu-default.png";
import puhuEncouraging from "../../../web/public/mascot/puhu/puhu-encouraging.png";
import puhuHappy from "../../../web/public/mascot/puhu/puhu-happy.png";
import puhuPremiumHero from "../../../web/public/mascot/puhu/puhu-premium-hero.png";
import puhuTalkBlink from "../../../web/public/mascot/puhu/motion/blink.png";
import puhuTalkLookDown from "../../../web/public/mascot/puhu/motion/look-down.png";
import puhuTalkRest from "../../../web/public/mascot/puhu/motion/rest.png";
import puhuTalkClosed from "../../../web/public/mascot/puhu/motion/talk-closed.png";
import puhuMaskBlink from "../../../web/public/mascot/puhu/motion/premium/blink.png";
import puhuMaskLookDown from "../../../web/public/mascot/puhu/motion/premium/look-down.png";
import puhuMaskRest from "../../../web/public/mascot/puhu/motion/premium/rest.png";
import puhuMaskClosed from "../../../web/public/mascot/puhu/motion/premium/talk-closed.png";
import chestClosed from "../../../web/public/visuals/chest/chest-closed.webp";
import chestOpen from "../../../web/public/visuals/chest/chest-open.webp";
import chestOpenClip from "../../../web/public/visuals/chest/chest-open-tall.mp4";
import chestDeskClosed from "../../../web/public/visuals/chest/desk-chest-closed-tall.webp";
import chestDeskOpen from "../../../web/public/visuals/chest/desk-chest-open-tall.webp";

export const art = {
  lampShade,
  puhuLampRest,
  puhuLampReach,
  puhuDefault,
  puhuHappy,
  puhuEncouraging,
  puhuPremiumHero,
  flame,
  chestClosed,
  chestOpen,
} as const;

/**
 * The weekly chest scene's 9:16 desk (the web's upright set): the clip's own first and last
 * frames as stills, and the clip of Puhu opening it.
 */
export const chestSceneArt = {
  closed: chestDeskClosed,
  open: chestDeskOpen,
  clip: chestOpenClip,
} as const;

/**
 * Puhu while he speaks (the web's `PuhuSpeakingMascot`); Premium gets him in his mask. Each set
 * shares one crop box, so swapping frames never moves him.
 */
export const puhuSpeakingArt = {
  free: {
    rest: puhuTalkRest,
    talkClosed: puhuTalkClosed,
    blink: puhuTalkBlink,
    lookDown: puhuTalkLookDown,
  },
  premium: {
    rest: puhuMaskRest,
    talkClosed: puhuMaskClosed,
    blink: puhuMaskBlink,
    lookDown: puhuMaskLookDown,
  },
} as const;

/** The daily mood faces, 1 (draining) to 5 (great); the web's `MOOD_IMAGE_BY_VALUE`. */
export const moodArt: Record<number, number> = {
  1: moodDraining,
  2: moodLow,
  3: moodBalanced,
  4: moodGood,
  5: moodGreat,
};

/** Puhu dressed for the user's field; replaces the classic Puhu wherever he speaks. */
export const careerArt: Record<CareerGroup, number> = {
  SAGLIK: careerSaglik,
  MUHENDISLIK: careerMuhendislik,
  YAZILIM: careerYazilim,
  HUKUK_KAMU: careerHukukKamu,
  EGITIM: careerEgitim,
  ISLETME: careerIsletme,
  SOSYAL_ILETISIM: careerSosyalIletisim,
  SANAT_TASARIM: careerSanatTasarim,
  FEN: careerFen,
  MIMARLIK: careerMimarlik,
};

/** The badge painted for each achievement (the web's `/achievements/puhu/{artKey}.webp`). */
export const achievementArt: Record<AchievementId, number> = {
  dream_space_created: achDreamSpaceCreated,
  first_hello: achFirstHello,
  first_step: achFirstStep,
  helped_someone: achHelpedSomeone,
  mistake_revisited: achMistakeRevisited,
  returned_to_path: achReturnedToPath,
  rhythm_found: achRhythmFound,
  rhythm_kept: achRhythmKept,
  route_drawn: achRouteDrawn,
  route_renewed: achRouteRenewed,
  starting_point_set: achStartingPointSet,
  week_reflected: achWeekReflected,
};

/** The medallion of each journey level (the web's `/img/levels/{key}.webp`). */
export const levelArt: Record<JourneyLevelKey, number> = {
  compass: levelCompass,
  constellation: levelConstellation,
  cycle: levelCycle,
  flow: levelFlow,
  horizon: levelHorizon,
  lantern: levelLantern,
  rhythm: levelRhythm,
  root: levelRoot,
  spark: levelSpark,
  star: levelStar,
  trail: levelTrail,
  wing: levelWing,
};
