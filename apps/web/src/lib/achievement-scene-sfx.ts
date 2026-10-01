/**
 * The "Işık Yandı" sound design, synthesised: no samples, no licences. A port of the voices behind
 * the approved film (design/achievement-scene/sfx.mjs). Pure and DOM-free so it is testable in
 * Node; achievement-scene-audio.ts turns the clips into AudioBuffers and schedules them.
 *
 * Each voice is rendered once, dry, at gain 1 and pitch 1; the scheduler applies a cue's gain, pan
 * and pitch (as playback rate). The film's room is a Schroeder reverb over the whole mix. It is
 * linear and time-invariant, so it is shipped as its impulse response and run by a native
 * ConvolverNode: the same sound, without spending the main thread on six filters per sample.
 */
import { ACHIEVEMENT_CHIME_NOTES } from "./achievement-sound";
import {
  bandPass,
  blockStart,
  envelope,
  mix,
  noise,
  noiseSweep,
  panGains,
  tone,
  type StereoClip,
  type Track,
} from "./achievement-scene-synth";

export { synthesizeRoom, type StereoClip } from "./achievement-scene-synth";

export type SfxVoice =
  | "spark"
  | "gather"
  | "pop"
  | "tap"
  | "burst"
  | "chime"
  | "swish"
  | "land"
  | "twinkle"
  | "press"
  | "fly"
  | "arrive";

export interface SfxCue {
  /** Seconds after the moment the cue list hangs off. */
  at: number;
  voice: SfxVoice;
  gain?: number;
  pitch?: number;
  /** -1 (left) … 1 (right). */
  pan?: number;
}

/** The hum swells for as long as the light can wait (the automatic ignite) plus its windup. */
export const GATHER_LENGTH = 1.65;
/** Everything the scene plays goes through this gain, then a limiter. */
export const SCENE_MASTER_GAIN = 0.8;
const TAU = Math.PI * 2;

/** Seconds of dry sound; the room adds the tail at playback. */
const VOICE_LENGTH: Record<SfxVoice, number> = {
  spark: 0.62,
  gather: GATHER_LENGTH,
  pop: 0.09,
  tap: 0.05,
  burst: 1.05,
  chime: Math.max(...ACHIEVEMENT_CHIME_NOTES.map((note) => note.offset + note.duration)),
  swish: 0.3,
  land: 0.32,
  twinkle: 0.35,
  press: 0.06,
  fly: 0.66,
  arrive: 0.6,
};

function gather(track: Track): void {
  const n = Math.round(GATHER_LENGTH * track.rate);
  const filter = bandPass(track.rate);
  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  let swell = 0;
  let tremolo = 0;
  let gains = panGains(0);
  for (let i = 0; i < n; i += 1) {
    const t = i / track.rate;
    const p = t / GATHER_LENGTH;
    if (blockStart(i)) {
      swell = (0.25 + 0.75 * p ** 1.8) * Math.min(1, t / 0.25);
      tremolo = 0.6 + 0.4 * Math.sin(TAU * (5 + 9 * p) * t);
      filter.tune(1500 + 4000 * p);
      gains = panGains(Math.sin(TAU * 0.35 * t) * 0.25);
    }
    p1 += (TAU * 220 * (1 + 0.5 * p)) / track.rate;
    p2 += (TAU * 329.63 * (1 + 0.5 * p) * 1.003) / track.rate;
    p3 += (TAU * 1760 * (1 + 0.25 * p)) / track.rate;
    const band = filter.run(track.random() * 2 - 1, 0.3);
    const v = 0.08 * Math.sin(p1) + 0.065 * Math.sin(p2) + 0.03 * Math.sin(p3) * tremolo + 0.1 * band;
    mix(track, i, v * swell, gains);
  }
}

/** Low bloom with a pitch drop, a bright air burst, then a scatter of tiny pings. */
function burst(track: Track): void {
  const n = Math.round(0.9 * track.rate);
  const centre = panGains(0);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / track.rate;
    phase += (TAU * (55 + 85 * Math.exp(-t / 0.06))) / track.rate;
    mix(track, i, Math.sin(phase) * envelope(t, 0.004, 0.22) * 0.42, centre);
  }
  noiseSweep(track, { dur: 0.7, from: 6000, to: 1400, gain: 0.3, shape: "fall", damping: 0.9 });
  for (let k = 0; k < 14; k += 1) {
    tone(track, {
      freq: 2200 + track.random() * 3800,
      start: 0.05 + track.random() * 0.85,
      dur: 0.12,
      gain: 0.03 + track.random() * 0.03,
      attack: 0.002,
      decay: 0.035,
      pan: track.random() * 1.6 - 0.8,
    });
  }
}

const VOICES: Record<SfxVoice, (track: Track) => void> = {
  spark: (track) => {
    noiseSweep(track, { dur: 0.62, from: 700, to: 3600, gain: 0.32, shape: "bell", panFrom: -0.35, panTo: 0 });
    tone(track, { freq: 620, dur: 0.6, gain: 0.05, attack: 0.08, decay: 0.3, glide: 1.1 });
  },
  gather,
  pop: (track) => tone(track, { freq: 560, dur: 0.09, gain: 0.14, attack: 0.003, decay: 0.03, glide: 0.7 }),
  tap: (track) => {
    noiseSweep(track, { dur: 0.012, from: 5000, to: 2500, gain: 0.5, shape: "fall" });
    tone(track, { freq: 2900, dur: 0.05, gain: 0.07, decay: 0.012 });
  },
  burst,
  // The app's own three-note signature (achievement-sound.ts), voiced like the film.
  chime: (track) => {
    for (const note of ACHIEVEMENT_CHIME_NOTES) {
      tone(track, {
        freq: note.frequency,
        start: note.offset,
        dur: note.duration,
        gain: 0.2,
        attack: 0.025,
        decay: note.duration / 3.2,
        harmonic: 0.12,
        pan: (note.frequency - 820) / 900,
      });
    }
  },
  swish: (track) =>
    noiseSweep(track, { dur: 0.3, from: 1300, to: 6200, gain: 0.3, shape: "bell", panFrom: -0.5, panTo: 0.5 }),
  land: (track) => tone(track, { freq: 523.25, dur: 0.32, gain: 0.1, attack: 0.004, decay: 0.09, harmonic: 0.3 }),
  twinkle: (track) => {
    tone(track, { freq: 2637, dur: 0.35, gain: 0.07, attack: 0.002, decay: 0.07 });
    tone(track, { freq: 3520, start: 0.05, dur: 0.3, gain: 0.05, attack: 0.002, decay: 0.06 });
  },
  press: (track) => {
    noiseSweep(track, { dur: 0.014, from: 3800, to: 1800, gain: 0.45, shape: "fall" });
    tone(track, { freq: 1500, dur: 0.06, gain: 0.08, decay: 0.016 });
  },
  fly: (track) =>
    noiseSweep(track, { dur: 0.66, from: 3200, to: 800, gain: 0.28, shape: "bell", panFrom: 0.2, panTo: -0.6 }),
  arrive: (track) => {
    tone(track, { freq: 1318.5, dur: 0.6, gain: 0.12, attack: 0.003, decay: 0.16, pan: -0.5 });
    tone(track, { freq: 1975.5, start: 0.04, dur: 0.5, gain: 0.07, attack: 0.003, decay: 0.12, pan: -0.5 });
  },
};

const VOICE_SEED: Record<SfxVoice, number> = {
  spark: 1,
  gather: 2,
  pop: 3,
  tap: 4,
  burst: 5,
  chime: 6,
  swish: 7,
  land: 8,
  twinkle: 9,
  press: 10,
  fly: 11,
  arrive: 12,
};

/** One voice, dry. Its tail comes from the room at playback. */
export function synthesizeVoice(voice: SfxVoice, sampleRate: number): StereoClip {
  const length = Math.ceil(VOICE_LENGTH[voice] * sampleRate);
  const track: Track = {
    left: new Float32Array(length),
    right: new Float32Array(length),
    rate: sampleRate,
    random: noise(VOICE_SEED[voice]),
  };
  VOICES[voice](track);
  return { left: track.left, right: track.right, sampleRate };
}

export const SFX_VOICES = Object.keys(VOICE_LENGTH) as SfxVoice[];
