/**
 * One frame of the "Işık Yandı" scene. Every pose comes from scene-poses for scene time `t`; this
 * file only writes them to the DOM parts and repaints the canvases. The scene clock calls it from
 * requestAnimationFrame, never during a React render.
 */
import { DECK_ADVANCE, type DeckLayout, type SceneBeats, type SceneLight } from "./scene-choreography";
import { clamp, progress, type Point } from "./scene-engine";
import {
  cameraScale,
  copyPose,
  curtainPose,
  deckBadgePose,
  exitBadgePose,
  flashOpacity,
  haloPose,
  hintPose,
  singleBadgePose,
  sparklePop,
  type BadgePose,
  type CopyPose,
  type StageGeometry,
} from "./scene-poses";
import { applyBadgePose, lightBadge, sweepGlints } from "./scene-frame-badges";
import { beginPaint, type ScenePaints } from "./scene-canvas";
import type { SceneDom } from "./scene-dom";
import { CURTAIN_SHEET, paintSky } from "./paint-sky";
import { paintMotes, paintOrb, paintSpark, type LightScene } from "./paint-light";
import { paintBurst, paintCornerSparkles, paintFlights, paintFlips, type BurstScene } from "./paint-burst";

export interface HomeTarget {
  center: Point;
  size: number;
}

export interface SceneFrame {
  t: number;
  beats: SceneBeats;
  geo: StageGeometry;
  /** A backfill summary deals a fan; `null` for a single achievement. */
  deck: DeckLayout | null;
  /** One per card on stage. */
  lights: ReadonlyArray<SceneLight>;
  origin: Point;
  home: HomeTarget | null;
  /** Whole-scene opacity: 1, or a dismiss fade-out / restore fade-in. */
  presence: number;
}

/** Gap between a fanned card and its title, px. */
const LABEL_GAP = 4;
/** The mark on the card back starts to burn hotter this long after the burst, until the flip. */
const MARK_HEAT_FROM = 0.3;
/** Card titles and the "+N" leave a beat after "Devam edelim". */
const LABELS_OUT = { delay: 0.1, duration: 0.18 } as const;

interface Placed {
  /** Where the card is in the reveal; the exit flight starts from here. */
  rest: BadgePose;
  pose: BadgePose;
  edge: number;
}

function placeBadges(dom: SceneDom, frame: SceneFrame): Array<Placed | null> {
  const { t, beats, geo, deck, home } = frame;
  const edge = deck ? deck.card : geo.size;
  return dom.badges.map((_, i) => {
    const rest = deck ? deckBadgePose(i, t, beats, deck, geo) : singleBadgePose(t, beats, geo);
    if (!rest) return null;
    return { rest, pose: exitBadgePose(rest, i, t, beats, { size: geo.size, edge }, home), edge };
  });
}

/** The stack keeps its first card on top; in the fan the middle card is the front of the hand. */
function cardDepth(deck: DeckLayout, i: number, tossed: boolean): number {
  if (!tossed) return 20 - i;
  const fan = deck.fan[i];
  return fan ? 10 - Math.round(Math.abs(fan.dx) / (deck.card * DECK_ADVANCE)) : 0;
}

function writeStage(dom: SceneDom, frame: SceneFrame, curtain: ReturnType<typeof curtainPose>, camera: number): void {
  const { t, beats, geo } = frame;
  dom.root.style.opacity = String(frame.presence);
  dom.duskSheet.style.transform = `translate3d(0, ${curtain.shift * 100}%, 0)`;
  dom.duskGlow.style.opacity = String(curtain.night);
  dom.cam.style.transformOrigin = `${geo.center.x}px ${geo.center.y}px`;
  dom.cam.style.transform = `scale(${camera})`;
  const halo = haloPose(t, beats, curtain.night);
  dom.halo.style.opacity = String(halo.opacity);
  dom.halo.style.transform = `translate3d(${geo.center.x}px, ${geo.center.y}px, 0) translate(-50%, -50%) scale(${halo.scale})`;
  dom.flash.style.opacity = String(flashOpacity(t, beats));
  if (dom.hint) {
    const hint = hintPose(t, beats);
    dom.hint.style.opacity = String(hint.opacity);
    dom.hint.style.transform = `translate3d(0, ${hint.y}px, 0) scale(${hint.scale})`;
  }
}

function writeBadges(dom: SceneDom, frame: SceneFrame, placed: ReadonlyArray<Placed | null>): void {
  const { t, beats, deck, lights } = frame;
  const labelsOut = beats.exit === null ? 0 : progress(t, beats.exit + LABELS_OUT.delay, LABELS_OUT.duration);
  const burst = beats.burst ?? 0;
  placed.forEach((entry, i) => {
    const badge = dom.badges[i];
    if (!badge) return;
    if (!entry) {
      badge.root.style.opacity = "0";
      return;
    }
    const { pose, edge } = entry;
    applyBadgePose(badge, pose, edge);
    const heat = progress(t, burst + MARK_HEAT_FROM, pose.flipStart - burst - MARK_HEAT_FROM);
    lightBadge(badge, pose.theta, heat, (lights[i] ?? lights[0]!).glow);
    sweepGlints(badge, t, pose.flipStart);
    badge.root.style.zIndex = String(deck ? cardDepth(deck, i, pose.tossed) : 1);
    const label = dom.labels[i];
    if (!label) return;
    const reach = (edge * (pose.sx + pose.sy)) / 4;
    label.style.transform = `translate3d(${pose.x}px, ${pose.y + reach + LABEL_GAP}px, 0) translateX(-50%)`;
    label.style.opacity = String(clamp(pose.settle) * (1 - labelsOut));
  });
}

/** "+N" rides the top-right corner of the right-most card. */
function writeMore(dom: SceneDom, frame: SceneFrame, placed: ReadonlyArray<Placed | null>, copy: CopyPose): void {
  if (!dom.more || !frame.deck) return;
  let right = 0;
  frame.deck.fan.forEach((slot, i) => {
    if (slot.dx > frame.deck!.fan[right]!.dx) right = i;
  });
  const entry = placed[right];
  if (!entry) {
    dom.more.style.opacity = "0";
    return;
  }
  const reach = (entry.edge * (entry.pose.sx + entry.pose.sy)) / 4;
  dom.more.style.transform = `translate3d(${entry.pose.x + reach}px, ${entry.pose.y - reach}px, 0) translate(-50%, -50%)`;
  dom.more.style.opacity = String(copy.eyebrow.opacity);
}

function writeCopy(dom: SceneDom, copy: CopyPose): void {
  dom.eyebrow.style.opacity = String(copy.eyebrow.opacity);
  dom.eyebrow.style.transform = `translate3d(0, ${copy.eyebrow.y}px, 0)`;
  copy.words.forEach((word, i) => {
    const node = dom.words[i];
    if (!node) return;
    node.style.opacity = String(word.opacity);
    node.style.transform = `translate3d(0, ${word.y}px, 0) scale(${word.scale})`;
  });
  dom.body.style.opacity = String(copy.body.opacity);
  dom.body.style.transform = `translate3d(0, ${copy.body.y}px, 0)`;
  dom.ledge.style.opacity = String(copy.ledge.opacity);
  dom.ledge.style.transform = `translate3d(0, ${copy.ledge.y}px, 0)`;
  const pressed = copy.ledge.pressed ? "true" : "false";
  if (dom.ledge.dataset.pressed !== pressed) dom.ledge.dataset.pressed = pressed;
}

function paintCanvases(
  paints: ScenePaints,
  frame: SceneFrame,
  curtain: ReturnType<typeof curtainPose>,
  camera: number,
  placed: ReadonlyArray<Placed | null>,
): void {
  const { t, beats, geo } = frame;
  beginPaint(paints.stars, paints.ratio);
  beginPaint(paints.back, paints.ratio);
  beginPaint(paints.front, paints.ratio);
  const sheetTop = curtain.shift * CURTAIN_SHEET * geo.viewport.height;
  paintSky(paints.stars, t, geo.viewport, geo.center, sheetTop, curtain.night, camera);

  const first = frame.lights[0]!;
  const light: LightScene = {
    back: paints.back,
    front: paints.front,
    t,
    beats,
    center: geo.center,
    size: geo.size,
    origin: frame.origin,
    glow: first.glow,
    alt: first.alt,
  };
  paintSpark(light);
  paintMotes(light);
  paintOrb(light);

  const burst: BurstScene = {
    back: paints.back,
    front: paints.front,
    t,
    beats,
    center: geo.center,
    size: geo.size,
    lights: frame.lights,
    lift: curtain.lift,
  };
  paintBurst(burst);
  const cards = placed.flatMap((entry, i) => (entry ? [{ ...entry, i }] : []));
  paintFlips(
    burst,
    cards.map(({ rest, edge }) => ({
      start: rest.flipStart,
      center: { x: rest.x, y: rest.y },
      scale: ((rest.sx + rest.sy) / 2) * (edge / geo.size),
      theta: rest.theta,
    })),
  );
  if (!frame.deck && cards[0]) paintCornerSparkles(burst, cards[0].rest.flipStart, sparklePop);
  paintFlights(
    burst,
    cards.map(({ rest, i }) => ({ from: { x: rest.x, y: rest.y }, order: i, light: frame.lights[i] ?? first })),
    frame.home,
  );
}

export function paintSceneFrame(dom: SceneDom, paints: ScenePaints, frame: SceneFrame): void {
  const curtain = curtainPose(frame.t, frame.beats);
  const camera = cameraScale(frame.t, frame.beats);
  const placed = placeBadges(dom, frame);
  const copy = copyPose(frame.t, frame.beats, dom.words.length);
  writeStage(dom, frame, curtain, camera);
  writeBadges(dom, frame, placed);
  writeMore(dom, frame, placed, copy);
  writeCopy(dom, copy);
  paintCanvases(paints, frame, curtain, camera, placed);
}
