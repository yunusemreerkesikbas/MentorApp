/**
 * Brand art, imported straight from the web app's public folder so there is one copy of every
 * image in the repo. Metro already watches the monorepo root (`metro.config.js`), and only the
 * files named here end up in the bundle.
 *
 * ponytail: the mood faces are web-sized originals (up to ~0.9 MB for a 28dp glyph). Fine in
 * development; export phone-sized copies before the first store build.
 */
import type { CareerGroup } from "@mentor/types";
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
import chestClosed from "../../../web/public/visuals/chest/chest-closed.webp";
import chestOpen from "../../../web/public/visuals/chest/chest-open.webp";

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
