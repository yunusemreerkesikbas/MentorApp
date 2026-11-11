// T1 "Ekrana dalış": every scene window, beat event and clip cut lives here, so Vitest can check
// the timing without a browser. 120 BPM, one beat = BEAT (15) frames.

export type SceneId = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12" | "13" | "14" | "15" | "16" | "17";
export type Scene = { id: SceneId; name: string; from: number; durationInFrames: number };

const sec = (s: number) => Math.round(s * 30);

// [id, name, from s, to s] from the spec's structure table.
const WINDOWS: [SceneId, string, number, number][] = [
  ["01", "Kanca", 0, 1.5],
  ["02", "Bildirim", 1.5, 2.5],
  ["03", "K1 dalış", 2.5, 6],
  ["04", "Sınavlar", 6, 8],
  ["05", "Albüm", 8, 12],
  ["06", "Pano", 12, 16],
  ["07", "Şehrin üstünde", 16, 20],
  ["08", "Ekranlar", 20, 24],
  ["09", "Odalar", 24, 28],
  ["10", "Puhu'nun odası", 28, 32],
  ["11", "Defter", 32, 36],
  ["12", "Masa", 36, 40],
  ["13", "Topluluk", 40, 44],
  ["14", "Sandık", 44, 48],
  ["15", "Lakap", 48, 54],
  ["16", "Senin odan", 54, 58.5],
  ["17", "Final", 58.5, 62],
];

export const SCENES: readonly Scene[] = WINDOWS.map(([id, name, a, b]) => ({ id, name, from: sec(a), durationInFrames: sec(b) - sec(a) }));

export const sceneOf = (id: SceneId): Scene => SCENES.find((s) => s.id === id)!;

// Beat events per scene, in scene-local frames (each scene task fills its own).
export const EVENTS: Record<SceneId, Record<string, number>> = {
  "01": { hookA: 0, hookB: 15, clock: 0 },
  "02": { notif: 0, shake: 0, peek: 15 },
  "03": { clip: 0, come: 15, flash: 90 },
  "04": { land: 0, line1: 0, line2: 15, pills: 15 },
  "05": { page: 0, q1: 0, pair1: 15, pair2: 30, pair3: 45, pair4: 60, pair5: 75, q2: 90, peel: 105 },
  "06": { planla: 0, board: 0, pol1: 15, pol2: 30, pol3: 45, pol4: 60, goal: 75, note: 90, heart: 90, kodcu: 105 },
  "07": { streak: 0, loop: 0, words: 15, card1: 45, card2: 60, card3: 75 },
  "08": { fly: 0, tick1: 15, tick2: 30, tick3: 45, spell: 45, slide: 60, next: 75, circle: 105 },
  "09": { odaklan: 0, ev: 15, kafe: 30, kutuphane: 45, dial: 60, words: 75 },
  "10": { ring: 0, finish: 15, timer: 60, xp: 75, streak: 90, mola: 90, slip: 105 },
  "11": { slip: 0, lift: 15, fill: 30, page1: 45, page2: 60, page3: 75, review: 90, solved: 105, peek: 105 },
  "12": { slide: 0, cut: 15, birlikte: 15, words: 30, clap: 90 }, // clap: K4's two high-fives meet
  "13": { ask: 0, q: 15, a: 45, puhu: 75 },
  "14": { days: 0, devirdin: 15, dive: 30, clip: 45, ready: 60, flash: 75, card: 105 },
  "15": { show1: 0, flip2: 30, flip3: 75, stop: 90, words: 105 }, // each flip is one turn of a beat
  "16": { light: 15, lit: 45, dive: 60, clip: 75 },
  "17": { end1: 0, end2: 15, end3: 30, hop: 30, endCard: 45 },
};

// One stretch of a clip inside its scene: `at` (scene-local frame) for `frames` frames, reading the clip from
// clipStart to clipEnd (seconds). The playback rate follows from the two.
export type Cut = { at: number; clipStart: number; clipEnd: number; frames: number };
export const rate = (c: Cut): number => ((c.clipEnd - c.clipStart) * 30) / c.frames;
// A sped-up <Video> counts durationInFrames in source frames, so it gets the clip stretch, not the slot.
export const sourceFrames = (c: Cut): number => Math.ceil((c.clipEnd - c.clipStart) * 30 - 1e-9);

// Kling clips scale 6 % up from the top centre, so the "KlingAI 4.0" mark (from 96 % of the height) falls
// below the frame.
export const CLIP_SCALE = 1.06;
export const KLING_MARK_TOP = 0.96;
// The app's chest clip has a jump between these seconds; no cut reads it.
export const CHEST_JUMP = [1.6, 1.8] as const;

export const CLIP_CUTS: Record<"K1" | "K3" | "K4" | "K5" | "chest", { scene: SceneId; cuts: Cut[] }> = {
  // Climb, two beckons, flip, dive; ends as his feet vanish, under scene 03's white flash.
  K1: { scene: "03", cuts: [{ at: 0, clipStart: 0.25, clipEnd: 4.3, frames: 105 }] },
  // Glasses push, turbo study, book slam (~3,4 s), cheer.
  K3: { scene: "10", cuts: [{ at: 0, clipStart: 0.3, clipEnd: 4.95, frames: 120 }] },
  // After the notebook-to-table match cut: wave, high-fives, back to the books.
  K4: { scene: "12", cuts: [{ at: 15, clipStart: 0.3, clipEnd: 4.5, frames: 105 }] },
  // Jump cut: spring onto the desk and wave, then the two-wing point (skips the peek behind the chair).
  K5: { scene: "16", cuts: [{ at: 75, clipStart: 0.25, clipEnd: 1.35, frames: 33 }, { at: 108, clipStart: 3.55, clipEnd: 4.45, frames: 27 }] },
  // Lid starts opening (1,3 s) in the first cut; the cut at 77 skips the jump under the gold flash's peak.
  chest: { scene: "14", cuts: [{ at: 45, clipStart: 0.4, clipEnd: 1.6, frames: 32 }, { at: 77, clipStart: 1.8, clipEnd: 3.6, frames: 43 }] },
};
