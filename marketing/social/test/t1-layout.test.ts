import { expect, it } from "vitest";
import { SLIP } from "../src/t1/parts/QuestionSlip";
import { CARDS } from "../src/t1/scenes/S07";
import { SLIP_END } from "../src/t1/scenes/S10";
import { BAND, BIG, CHEST, CHEST_WORDS } from "../src/t1/scenes/S14";
import { EXAMS_SIZE } from "../src/t1/scenes/S17";

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Puhu's head, measured on the rendered film (frames 590 and 955), with a little room around it.
const FACE_07: Box = { x: 430, y: 620, w: 280, h: 280 };
const FACE_10: Box = { x: 330, y: 800, w: 520, h: 500 };

it("07: the plan cards settle off Puhu's head", () => {
  const widths = [360, 465, 370]; // the cards' rendered widths (they size to their text)
  CARDS.forEach((c, i) => expect(overlaps({ x: c.x, y: c.y, w: widths[i]!, h: 110 }, FACE_07), c.text).toBe(false));
});

it("10: the question slip ends off K3 Puhu's face", () => {
  const w = SLIP.width * SLIP_END.scale;
  const h = SLIP.height * SLIP_END.scale;
  expect(overlaps({ x: SLIP_END.x - w / 2, y: SLIP_END.y - h / 2, w, h }, FACE_10)).toBe(false);
});

it("14: the chest clip fills the screen width under a night band that holds the words", () => {
  expect(BIG.left).toBe(0);
  expect(BIG.width).toBe(1080);
  // StickerWords set lines at lineHeight 1.05; the outline and shadow add a few px.
  expect(CHEST_WORDS.top + CHEST_WORDS.size * 1.05 + 12).toBeLessThanOrEqual(BAND);
  expect(CHEST.y).toBeLessThan(1920 - 250); // the card leaves the chest above Instagram's caption zone
});

it("17: the exams line stays inside the 900 px safe width", () => {
  // Measured on the render: 742 px wide at 40 px. Centred, it must stay within x 180–900.
  expect((742 / 40) * EXAMS_SIZE).toBeLessThanOrEqual(720);
});
