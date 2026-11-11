import type { SOUND } from "../art";
import { EVENTS, sceneOf, type SceneId } from "./timeline";

export type SfxKey = Extract<keyof typeof SOUND, `t1Sfx${string}`>;

// Measured on the downloads (mono, 30 fps frames). The main hit is the file's loudest 50 ms; `trim` cuts what
// comes before its attack (the first sample within 20 dB of the peak, looking 0.3 s back), `hit` = frames from
// the trimmed start to that loudest 50 ms. `loud` = its RMS, `peak` = the trimmed file's peak, both dBFS.
export const SFX: Record<SfxKey, { trim: number; hit: number; loud: number; peak: number }> = {
  t1SfxPing: { trim: 2, hit: 0, loud: -14.8, peak: -7.9 },
  t1SfxWhoosh: { trim: 2, hit: 2, loud: -10.1, peak: -2.3 },
  t1SfxBlop: { trim: 1, hit: 5, loud: -12.9, peak: -4.6 },
  t1SfxStamp: { trim: 3, hit: 1, loud: -18.2, peak: -3.7 },
  t1SfxPop: { trim: 5, hit: 1, loud: -9.5, peak: 0 },
  t1SfxSlap: { trim: 4, hit: 2, loud: -1.6, peak: 0 },
  t1SfxTear: { trim: 6, hit: 8, loud: -19.7, peak: -7.3 },
  t1SfxPin: { trim: 45, hit: 5, loud: -9.8, peak: -2.0 }, // the tack goes in at 1.6 s, after a softer touch
  t1SfxSparkle: { trim: 6, hit: 6, loud: -15.3, peak: -6.1 },
  t1SfxSwish: { trim: 4, hit: 4, loud: -34.8, peak: -26.0 },
  t1SfxClick: { trim: 4, hit: 4, loud: -25.6, peak: -4.4 },
  t1SfxRustle: { trim: 28, hit: 1, loud: -14.7, peak: 0 },
  t1SfxThump: { trim: 17, hit: 0, loud: -11.6, peak: -3.0 },
  t1SfxPage: { trim: 1, hit: 0, loud: -16.3, peak: -1.8 },
  t1SfxClap: { trim: 0, hit: 1, loud: -19.0, peak: -2.1 },
  t1SfxLid: { trim: 2, hit: 2, loud: -28.2, peak: -15.3 },
  t1SfxChime: { trim: 14, hit: 3, loud: -22.0, peak: -12.8 },
  t1SfxFlick: { trim: 6, hit: 5, loud: -27.5, peak: -13.0 },
  t1SfxSnap: { trim: 5, hit: 0, loud: -22.7, peak: -1.8 },
  t1SfxSwitch: { trim: 4, hit: 0, loud: -21.1, peak: -2.2 },
};

// The downloads differ by 33 dB, so each file is first levelled: its loudest 50 ms to −8 dB, its peak kept under
// −4.5 dB (sharp hits like the clap stay quieter rather than clip). `mix` (0.5–0.8) then sets it in the mix. The
// music plays at MUSIC_VOLUME (its loudest 50 ms −8.9 dB at 1). Measured on a draft render: the hits sit a median
// 4 dB under the music around them, and the mix peaks at −0.1 dB with no clipped sample.
export const MUSIC_VOLUME = 0.65;
const LEVEL = -8;
const PEAK = -4.5;
export const levelGain = (k: SfxKey): number => 10 ** (Math.min(LEVEL - SFX[k].loud, PEAK - SFX[k].peak) / 20);

export type Cue = { name: string; sound: SfxKey; scene: SceneId; event: string; offset?: number; mix: number };
export const cueFrame = (c: Cue): number => sceneOf(c.scene).from + EVENTS[c.scene]![c.event]! + (c.offset ?? 0);

const one = (scene: SceneId, label: string, sound: SfxKey, event: string, mix: number, offset?: number): Cue => ({ name: `${scene} · ${label}`, sound, scene, event, mix, offset });
const each = (scene: SceneId, label: string, sound: SfxKey, events: string[], mix: number): Cue[] => events.map((e, i) => one(scene, `${label} ${i + 1}`, sound, e, mix));
const steps = (scene: SceneId, label: string, sound: SfxKey, event: string, n: number, gap: number, mix: number): Cue[] =>
  Array.from({ length: n }, (_, i) => one(scene, `${label} ${i + 1}`, sound, event, mix, i * gap));

// PROMPTS §6 "Efektler", on the beats the scenes animate. Big words stamp, chips and cards pop.
export const CUES: Cue[] = [
  one("01", "dedin. damga", "t1SfxStamp", "hookB", 0.7),
  one("02", "Bildirim", "t1SfxPing", "notif", 0.6),
  one("03", "Dalış vuuş", "t1SfxWhoosh", "flash", 0.7),
  one("04", "İniş blop", "t1SfxBlop", "land", 0.5, 8), // LANDED in S04
  one("04", "Sınavlar damga", "t1SfxStamp", "line2", 0.6),
  ...steps("04", "Sınav pop", "t1SfxPop", "pills", 5, 8, 0.5), // PILL_GAP in S04
  one("05", "Sayfa küt", "t1SfxThump", "page", 0.6),
  ...each("05", "Çıkartma şap", "t1SfxSlap", ["pair1", "pair2", "pair3", "pair4", "pair5"], 0.6),
  one("05", "Soru damga", "t1SfxStamp", "q2", 0.7),
  one("05", "Kodcu cırt", "t1SfxTear", "peel", 0.8),
  one("06", "PLANLA damga", "t1SfxStamp", "planla", 0.8),
  ...each("06", "Raptiye tık", "t1SfxPin", ["pol1", "pol2", "pol3", "pol4"], 0.6),
  one("06", "Hedef pop", "t1SfxPop", "goal", 0.6),
  one("06", "Not pop", "t1SfxPop", "note", 0.5),
  one("06", "Kodcu şap", "t1SfxSlap", "kodcu", 0.5, 5),
  one("07", "Asa tıring", "t1SfxSparkle", "streak", 0.7),
  ...each("07", "Kart pop", "t1SfxPop", ["card1", "card2", "card3"], 0.6),
  one("08", "Kartlar fış", "t1SfxSwish", "fly", 0.8),
  ...each("08", "Tik", "t1SfxClick", ["tick1", "tick2", "tick3"], 0.5),
  one("08", "Not pop", "t1SfxPop", "spell", 0.5),
  one("08", "Sıradaki pop", "t1SfxPop", "next", 0.6),
  one("09", "ODAKLAN damga", "t1SfxStamp", "odaklan", 0.8),
  ...each("09", "Oda vuş", "t1SfxWhoosh", ["ev", "kafe", "kutuphane"], 0.6),
  ...steps("09", "Kadran klik", "t1SfxClick", "dial", 5, 2, 0.5), // one DIAL step every two frames
  one("10", "Halka vuuş", "t1SfxWhoosh", "ring", 0.5),
  one("10", "00:00 damga", "t1SfxStamp", "timer", 0.8),
  one("10", "XP pop", "t1SfxPop", "xp", 0.6),
  one("10", "Seri pop", "t1SfxPop", "streak", 0.6),
  one("10", "Mola pop", "t1SfxPop", "mola", 0.6, 4),
  one("10", "Fiş fış", "t1SfxSwish", "slip", 0.6),
  one("11", "Kâğıt fırt", "t1SfxRustle", "slip", 0.7),
  one("11", "Kapak fış", "t1SfxPage", "page1", 0.7, -7), // the cover starts its FLIP
  one("11", "Kapak pat", "t1SfxThump", "page1", 0.8),
  ...each("11", "Sayfa fış", "t1SfxPage", ["page2", "page3"], 0.7),
  one("11", "Tekrar pop", "t1SfxPop", "review", 0.5),
  one("11", "ÇÖZDÜM damga", "t1SfxStamp", "solved", 0.8),
  one("12", "BİRLİKTE damga", "t1SfxStamp", "birlikte", 0.8),
  one("12", "Çak bir beşlik", "t1SfxClap", "clap", 0.8),
  one("13", "Takıldın mı damga", "t1SfxStamp", "ask", 0.7),
  ...each("13", "Mesaj pop", "t1SfxPop", ["q", "a", "puhu"], 0.6),
  one("14", "Gün pop", "t1SfxPop", "days", 0.6),
  one("14", "Devirdin pop", "t1SfxPop", "devirdin", 0.6),
  one("14", "Pencere vuuş", "t1SfxWhoosh", "dive", 0.7),
  one("14", "Hazır pop", "t1SfxPop", "ready", 0.6),
  one("14", "Kapak gıcırtı", "t1SfxLid", "clip", 0.8, 24), // the lid starts opening at clip 1.3 s
  one("14", "Çan", "t1SfxChime", "flash", 0.7),
  one("14", "Kart fış", "t1SfxSwish", "card", 0.6),
  ...each("15", "Dönüş fıt", "t1SfxFlick", ["flip2", "flip3"], 0.7),
  one("15", "Tak", "t1SfxSnap", "stop", 0.8),
  one("16", "Işık uçuşu", "t1SfxSparkle", "light", 0.5),
  one("16", "Işık klik", "t1SfxSwitch", "lit", 0.8),
  one("16", "Dalış vuuş", "t1SfxWhoosh", "dive", 0.7, 8), // mid-dive
  ...each("17", "Final damga", "t1SfxStamp", ["end1", "end2", "end3"], 0.5), // the music hits too
  one("17", "Puhu iniş blop", "t1SfxBlop", "hop", 0.7, 9), // LANDED in S17
];
