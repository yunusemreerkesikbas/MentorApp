import type { Theme } from "@/lib/theme";

/**
 * Pure geometry and timing for the sidebar theme lamp. Kept free of React and the DOM so the
 * cadence can be unit tested — `apps/web` runs vitest in the `node` environment.
 */

/** Scene interaction, tracked separately from the theme it toggles. */
export type LampInteraction = "idle" | "near" | "hover" | "pulling";

/** How the owl answers the light right after the cord is pulled. */
export type PullReaction = "squint" | "widen";

/**
 * Which owl sprite is on screen. The art is whole-body exports rather than cut-out layers: an
 * image generator cannot hold a shared canvas across runs, so the wing and the pupils are
 * crossfaded instead of moved. Gaze changes hide behind a blink so two pupil positions never
 * dissolve through each other. `reach` already carries its own eyes, which is why a pull needs
 * no extra sprite.
 */
export type OwlPose = "rest" | "reach" | "blink" | "gazeLeft" | "gazeRight";

/** Where the pupils point. Changes are hidden behind a blink — see `nextIdleGaze`. */
export type OwlGaze = "centre" | "left" | "right";

export type LeanOffset = { x: number; y: number; tilt: number };

export type LampVariant = "rail" | "panel" | "header";

/* Idle blink cadence — slow enough to read as breathing, not as a nervous tic. */
export const BLINK_MIN_MS = 4000;
export const BLINK_MAX_MS = 7000;
export const BLINK_DURATION_MS = 140;
export const DOUBLE_BLINK_CHANCE = 0.2;
export const DOUBLE_BLINK_GAP_MS = 180;

/**
 * With whole-body sprites the pupils cannot move on their own, so the owl leans instead: a couple
 * of pixels toward the pointer reads as him turning to look. Any further and he slides.
 */
export const LEAN_MAX_X = 2;
export const LEAN_MAX_Y = 1.2;
/**
 * Cocking the head is the other half of the lean, and the half that actually sells it: the shift
 * alone slides a sticker sideways, while a few degrees around his feet reads as a body turning to
 * look. Pupils cannot do this work for us, so the whole owl does it.
 */
export const LEAN_MAX_TILT = 3;
/** Pointer distance from the scene centre at which the lean reaches its limit. */
export const LEAN_REACH_PX = 120;
/** Where he settles while the wing is up — leaning toward the cord, above and to his right. */
export const LEAN_AT_CORD: LeanOffset = {
  x: LEAN_MAX_X,
  y: -LEAN_MAX_Y,
  tilt: LEAN_MAX_TILT,
};

/** Crossfade between owl sprites. Short enough that the wing reads as one move, not a dissolve. */
export const POSE_FADE_MS = 130;

/** A pull is a flinch away from the new light, or a perk toward it. */
export const REACTION_SCALE: Record<PullReaction, number> = {
  squint: 0.96,
  widen: 1.04,
};

/* Cord travel on a pull, then it springs back past rest like a real string. */
export const CORD_PULL_PX = 5;
export const CORD_PULL_MS = 180;
/** Glow crossfade. Deliberately close to the global 200ms colour transition. */
export const GLOW_FADE_MS = 220;

/**
 * Where the ink actually sits inside an export. Layout below is written in *visible* pixels, and
 * `fitArt` inflates the image box to match — so a sprite with transparent margins lands exactly
 * where a trimmed one would. Numbers come from `node apps/web/scripts/inspect-png.mjs`.
 */
export type ArtBounds = {
  source: { width: number; height: number };
  /** Bounds of the painted region, as fractions of the source box. */
  painted: { left: number; top: number; width: number; height: number };
};

/** `lamp-shade.png` is trimmed, so the box *is* the shade. */
export const SHADE_ART: ArtBounds = {
  source: { width: 320, height: 282 },
  painted: { left: 0, top: 0, width: 1, height: 1 },
};

/**
 * The three owl sprites share one 320px canvas, and `rest` defines the anchor: `reach` is wider
 * only because the raised wing spills to the right, so measuring *it* would shove the body left
 * every time the wing goes up. Pinning all three to the resting body is what keeps the crossfade
 * from sliding.
 */
export const OWL_ART: ArtBounds = {
  source: { width: 320, height: 320 },
  painted: { left: 27 / 320, top: 17 / 320, width: 265 / 320, height: 274 / 320 },
};

/**
 * Tip of the raised wing in the `reach` sprite, as fractions of the *resting body* box — so `x`
 * is past 1, that being the whole point of the wing. The knob has to land here or the reach stops
 * reading as a reach, which is why the spec ties `pullCordLength` to it.
 */
export const OWL_WINGTIP = { x: 283 / 265, y: (84 - 17) / 274 } as const;

/**
 * Pivot for the tilt: his feet, which sit above the bottom of the box because the sprite is padded
 * with air. Spinning around the box centre instead would swing his feet out from under him.
 */
export const OWL_PIVOT = `50% ${(
  (OWL_ART.painted.top + OWL_ART.painted.height) * 100
).toFixed(1)}%`;

export type LampLayout = {
  width: number;
  height: number;
  /**
   * Invisible ring around the scene that tracks the pointer. Applied as padding + matching
   * negative margin so the footer layout does not grow, and so LanguageToggle is not shoved.
   */
  trackPadding: { top: number; right: number; bottom: number; left: number };
  shadeWidth: number;
  shadeCentreX: number;
  shadeTopY: number;
  pullCordX: number;
  pullCordLength: number;
  owl: { width: number; left: number } | null;
};

/**
 * Scene coordinates per sidebar state, in CSS px from the top-left of the scene box. The rail is
 * only 52px wide, so it carries the lamp alone; the owl needs the expanded panel to stay legible.
 */
export const LAMP_LAYOUT = {
  rail: {
    width: 44,
    height: 62,
    trackPadding: { top: 20, right: 36, bottom: 8, left: 8 },
    shadeWidth: 30,
    shadeCentreX: 22,
    shadeTopY: 12,
    // Dead centre, unlike the panel: the offset there exists only so the owl's wingtip can meet
    // the knob, and with no owl on the rail it just reads as a crooked lamp.
    pullCordX: 22,
    pullCordLength: 14,
    owl: null,
  },
  panel: {
    // The owl stands on the left and the lamp hangs over his shoulder. The shade is allowed to
    // overhang him because it ends well above his head (asserted in the spec); that overlap is
    // what lets the cord hang close enough for his raised wingtip to land on the knob.
    width: 92,
    height: 130,
    // The dock (whole footer + the empty column above it) is the gaze field; left is 0 because
    // LanguageToggle already sits on that side and bubbling covers it without stealing clicks.
    trackPadding: { top: 88, right: 32, bottom: 16, left: 0 },
    shadeWidth: 44,
    shadeCentreX: 64,
    shadeTopY: 10,
    pullCordX: 62,
    pullCordLength: 34,
    owl: { width: 60, left: 0 },
  },
  header: {
    // Compact panel hung from the *top* of the mobile header: the shade sits in the 64px bar,
    // Puhu hangs into the page below it. Smaller than the sidebar so he does not cover the
    // greeting. The in-flow slot stays `size-11`.
    width: 74,
    height: 104,
    trackPadding: { top: 0, right: 8, bottom: 12, left: 12 },
    shadeWidth: 35,
    shadeCentreX: 51,
    shadeTopY: 6,
    pullCordX: 51,
    pullCordLength: 28,
    owl: { width: 48, left: 0 },
  },
} as const satisfies Record<LampVariant, LampLayout>;

/**
 * The mobile header is `h-16` and the in-flow slot is `size-11`, both centered. Used as a
 * negative `top` so the hanging scene's ceiling is the header's top edge — the shade lives
 * in the bar, Puhu is what crosses the border.
 */
export const HEADER_HANG_OFFSET_PX = (64 - 44) / 2;

/** Padding + matching negative margin: hit area grows, layout box stays put. */
export function trackRingStyle(pad: LampLayout["trackPadding"]) {
  return {
    paddingTop: pad.top,
    paddingRight: pad.right,
    paddingBottom: pad.bottom,
    paddingLeft: pad.left,
    marginTop: -pad.top,
    marginRight: -pad.right,
    marginBottom: -pad.bottom,
    marginLeft: -pad.left,
  };
}

export const LAMP_ART = {
  shade: "/mascot/puhu/lamp/lamp-shade.png",
} as const;

export const OWL_SPRITES: Record<OwlPose, string> = {
  rest: "/mascot/puhu/lamp/puhu-lamp-rest.png",
  reach: "/mascot/puhu/lamp/puhu-lamp-reach.png",
  blink: "/mascot/puhu/lamp/puhu-lamp-blink.png",
  gazeLeft: "/mascot/puhu/lamp/puhu-lamp-gaze-left.png",
  gazeRight: "/mascot/puhu/lamp/puhu-lamp-gaze-right.png",
};

export type ArtFit = {
  /** Image box, at least as large as the painted region because of any baked-in margins. */
  width: number;
  height: number;
  /** Distance from the box edge to the painted region. */
  offsetLeft: number;
  offsetTop: number;
  paintedHeight: number;
};

/** Scales an export so its painted region measures `paintedWidth` px. */
export function fitArt(art: ArtBounds, paintedWidth: number): ArtFit {
  const scale = paintedWidth / (art.source.width * art.painted.width);
  const width = art.source.width * scale;
  const height = art.source.height * scale;

  return {
    width,
    height,
    offsetLeft: art.painted.left * width,
    offsetTop: art.painted.top * height,
    paintedHeight: art.painted.height * height,
  };
}

export type ShadeArtBox = {
  width: number;
  height: number;
  left: number;
  top: number;
  /** Y of the shade mouth, where the glow sits and the pull cord starts. */
  mouthY: number;
};

/** Places `lamp-shade.png` so its painted shade lands on the layout coordinates. */
export function shadeArtBox(
  layout: { shadeWidth: number; shadeCentreX: number; shadeTopY: number },
  art: ArtBounds = SHADE_ART,
): ShadeArtBox {
  const fit = fitArt(art, layout.shadeWidth);

  return {
    width: fit.width,
    height: fit.height,
    left: layout.shadeCentreX - layout.shadeWidth / 2 - fit.offsetLeft,
    top: layout.shadeTopY - fit.offsetTop,
    mouthY: layout.shadeTopY + fit.paintedHeight,
  };
}

export type OwlArtBox = { width: number; height: number; left: number; top: number };

/**
 * Places an owl sprite so his *body* is `owl.width` wide and stands on the floor of the scene.
 * The raised wing is free to overflow the box — that is exactly how it reaches past him.
 */
export function owlArtBox(
  owl: { width: number; left: number },
  sceneHeight: number,
  art: ArtBounds = OWL_ART,
): OwlArtBox {
  const fit = fitArt(art, owl.width);

  return {
    width: fit.width,
    height: fit.height,
    left: owl.left - fit.offsetLeft,
    top: sceneHeight - fit.paintedHeight - fit.offsetTop,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Dark is the lit state: the reference scene is a warm lamp against a night canvas. */
export function isLit(theme: Theme): boolean {
  return theme === "dark";
}

/** Turning the lamp on makes the owl flinch from the glare; turning it off lets him perk up. */
export function pullReaction(nextTheme: Theme): PullReaction {
  return isLit(nextTheme) ? "squint" : "widen";
}

export function reactionScale(reaction: PullReaction | null): number {
  return reaction ? REACTION_SCALE[reaction] : 1;
}

export function nextBlinkDelay(random: number): number {
  return BLINK_MIN_MS + clamp(random, 0, 1) * (BLINK_MAX_MS - BLINK_MIN_MS);
}

export function isDoubleBlink(random: number): boolean {
  return random < DOUBLE_BLINK_CHANCE;
}

/** Body offset for a pointer position, relative to the centre of the scene box. */
export function computeLean(
  pointer: { x: number; y: number },
  centre: { x: number; y: number },
): LeanOffset {
  const horizontal = clamp((pointer.x - centre.x) / LEAN_REACH_PX, -1, 1);

  return {
    x: horizontal * LEAN_MAX_X,
    y: clamp((pointer.y - centre.y) / LEAN_REACH_PX, -1, 1) * LEAN_MAX_Y,
    // Tilt follows the horizontal axis only: nodding at a pointer that merely moved up is noise.
    tilt: horizontal * LEAN_MAX_TILT,
  };
}

/** Reaching for the cord overrides pointer tracking — he leans at what he is grabbing. */
export function resolveLean(
  interaction: LampInteraction,
  pointerLean: LeanOffset,
): LeanOffset {
  return interaction === "idle" ? { x: 0, y: 0, tilt: 0 }
    : interaction === "near" ? pointerLean
    : LEAN_AT_CORD;
}

/**
 * The wing outranks a blink: if the pointer asked for a reach, showing closed eyes instead would
 * swallow the one frame the interaction exists for. The reach sprite carries its own eyes, so a
 * gaze cannot survive it either.
 */
export function owlPose(
  interaction: LampInteraction,
  blinking: boolean,
  gaze: OwlGaze = "centre",
): OwlPose {
  if (interaction === "hover" || interaction === "pulling") return "reach";
  if (blinking) return "blink";
  return gaze === "left" ? "gazeLeft" : gaze === "right" ? "gazeRight" : "rest";
}

/**
 * Pointer horizontal, as a fraction of the lean limit, at which he commits to looking that way —
 * and the lower mark at which he gives up. The two differ on purpose: one threshold would make him
 * flick his eyes every time the pointer jittered across it.
 */
export const GAZE_ENTER = 0.32;
export const GAZE_EXIT = 0.16;

export function gazeFromLean(lean: LeanOffset, current: OwlGaze): OwlGaze {
  const ratio = lean.x / LEAN_MAX_X;
  const magnitude = Math.abs(ratio);

  if (magnitude >= GAZE_ENTER) return ratio < 0 ? "left" : "right";
  return magnitude < GAZE_EXIT ? "centre" : current;
}

/** How often an idle blink also carries a glance. Every blink would read as shifty, not alive. */
export const GLANCE_CHANCE = 0.4;

/**
 * Picks what he looks at on the next idle blink. From a side he always comes back to centre, so a
 * glance is a there-and-back beat rather than a wander.
 */
export function nextIdleGaze(current: OwlGaze, random: number): OwlGaze {
  if (random >= GLANCE_CHANCE) return current;
  if (current !== "centre") return "centre";
  return random < GLANCE_CHANCE / 2 ? "left" : "right";
}
