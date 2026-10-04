/**
 * Building blocks of the achievement scene's synthesised sound (achievement-scene-sfx.ts): a
 * stereo track, seeded noise, a sweepable band-pass, enveloped tones and noise sweeps, and the
 * film's small room as an impulse response. Pure and DOM-free.
 */

export interface StereoClip {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

const TAU = Math.PI * 2;
const REVERB_TAIL = 0.6;
const REVERB_WET = 0.2;
/**
 * Envelopes, sweeps and pans move at control rate: once per block of this many samples (0.7 ms at
 * 48 kHz), which keeps a voice's render cheap enough for one idle slot.
 */
const BLOCK = 32;

export interface Track {
  left: Float32Array;
  right: Float32Array;
  rate: number;
  random: () => number;
}

/** mulberry32: the same noise on every render, so a voice always sounds the same. */
export function noise(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Constant-power pan, -1 (left) … 1 (right). */
export function panGains(pan: number): readonly [number, number] {
  const angle = ((pan + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

export function mix(track: Track, index: number, value: number, gains: readonly [number, number]): void {
  if (index < 0 || index >= track.left.length) return;
  track.left[index]! += value * gains[0];
  track.right[index]! += value * gains[1];
}

/** Chamberlin state-variable filter, band-pass out; retune it at control rate. */
export function bandPass(rate: number) {
  let low = 0;
  let band = 0;
  let f = 0;
  return {
    tune(cutoff: number) {
      f = 2 * Math.sin((Math.PI * Math.min(cutoff, rate / 6)) / rate);
    },
    run(x: number, damping: number) {
      const high = x - low - damping * band;
      band += f * high;
      low += f * band;
      return band;
    },
  };
}

/** True at the first sample of every control block. */
export const blockStart = (i: number) => i % BLOCK === 0;

export const envelope = (t: number, attack: number, decay: number) =>
  t < attack ? t / attack : Math.exp(-(t - attack) / decay);

interface ToneSpec {
  freq: number;
  start?: number;
  dur: number;
  gain: number;
  attack?: number;
  decay?: number;
  pan?: number;
  glide?: number;
  harmonic?: number;
}

export function tone(track: Track, spec: ToneSpec): void {
  const { freq, start = 0, dur, gain, attack = 0.006, pan = 0, glide = 0, harmonic = 0 } = spec;
  const decay = spec.decay ?? dur / 4;
  const n = Math.round(dur * track.rate);
  const offset = Math.round(start * track.rate);
  const gains = panGains(pan);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / track.rate;
    phase += (TAU * freq * (1 + glide * (t / dur))) / track.rate;
    const e = envelope(t, attack, decay) * (1 - Math.max(0, (t - dur + 0.02) / 0.02));
    mix(track, offset + i, (Math.sin(phase) + harmonic * Math.sin(phase * 2)) * e * gain, gains);
  }
}

interface SweepSpec {
  start?: number;
  dur: number;
  from: number;
  to: number;
  gain: number;
  damping?: number;
  shape: "bell" | "rise" | "fall";
  panFrom?: number;
  panTo?: number;
}

export function noiseSweep(track: Track, spec: SweepSpec): void {
  const { start = 0, dur, from, to, gain, damping = 0.45, shape, panFrom = 0, panTo = 0 } = spec;
  const n = Math.round(dur * track.rate);
  const offset = Math.round(start * track.rate);
  const filter = bandPass(track.rate);
  let level = 0;
  let gains = panGains(panFrom);
  for (let i = 0; i < n; i += 1) {
    if (blockStart(i)) {
      const p = i / n;
      filter.tune(from * (to / from) ** p);
      level = shape === "bell" ? Math.sin(Math.PI * p) ** 1.6 : shape === "rise" ? p ** 2.2 : (1 - p) ** 2.4;
      gains = panGains(panFrom + (panTo - panFrom) * p);
    }
    mix(track, offset + i, filter.run(track.random() * 2 - 1, damping) * level * gain, gains);
  }
}

/**
 * The film's room (four damped combs per side into two all-passes) as the impulse response of its
 * wet path, already at the film's wet level. Run it with `ConvolverNode.normalize = false`.
 */
export function synthesizeRoom(sampleRate: number): StereoClip {
  const length = Math.ceil(REVERB_TAIL * sampleRate);
  const scale = (delays: number[]) => delays.map((d) => Math.max(1, Math.round((d * sampleRate) / 44_100)));
  const combsLeft = scale([1557, 1617, 1491, 1422]);
  const combsRight = combsLeft.map((d) => d + 23);
  const allPasses = scale([556, 225]);
  const respond = (combs: number[]) => {
    const out = new Float32Array(length);
    for (const delay of combs) {
      const buffer = new Float32Array(delay);
      let index = 0;
      let damp = 0;
      for (let i = 0; i < length; i += 1) {
        const y = buffer[index]!;
        damp = y * 0.6 + damp * 0.4;
        buffer[index] = (i === 0 ? 1 : 0) + damp * 0.8;
        out[i]! += y;
        index = (index + 1) % delay;
      }
    }
    for (const delay of allPasses) {
      const buffer = new Float32Array(delay);
      let index = 0;
      for (let i = 0; i < length; i += 1) {
        const b = buffer[index]!;
        const y = -out[i]! + b;
        buffer[index] = out[i]! + b * 0.5;
        out[i] = y;
        index = (index + 1) % delay;
      }
    }
    for (let i = 0; i < length; i += 1) out[i]! *= REVERB_WET * 0.25;
    return out;
  };
  return { left: respond(combsLeft), right: respond(combsRight), sampleRate };
}
