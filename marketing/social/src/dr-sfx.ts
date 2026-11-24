import type { SfxKey } from "./t1/sfx";
import type { SOUND } from "./art";
import { sceneOf } from "./t1/timeline";

type SoundKey = keyof typeof SOUND;

// Wave 2 reels' effects (owner, 2026-11-23): T1's levelled effect set, no music. `at` = the frame the hit lands on
// (the file starts SFX[sound].hit frames earlier); the frames are the beats DR.tsx animates.
export type DrCue = { at: number; sound: SfxKey; mix: number };
export type DrId = "DRP" | "DRK" | "DRH" | "DRY";

// The end card's circle opens on endCardFrom (180 in the 8 s reels, 300 in the 12 s ones).
const endPop = (at: number): DrCue => ({ at: at + 1, sound: "t1SfxPop", mix: 0.6 });
const END_POP = endPop(180);

export const DR_CUES: Record<DrId, DrCue[]> = {
  DRP: [
    { at: 4, sound: "t1SfxStamp", mix: 0.7 }, // HEDEFİNİ DUVARA AS!
    ...[30, 42, 54, 66].map((at) => ({ at, sound: "t1SfxPin" as const, mix: 0.6 })), // four photos pinned
    { at: 98, sound: "t1SfxThump", mix: 0.6 }, // the goal card lands
    { at: 120, sound: "t1SfxWhoosh", mix: 0.6 }, // camera pushes into the phone
    { at: 144, sound: "t1SfxClick", mix: 0.7 }, // 07:29 → 07:30
    END_POP,
  ],
  DRK: [
    { at: 1, sound: "t1SfxStamp", mix: 0.7 }, // SEN HANGİ PUHU’SUN?
    ...Array.from({ length: 10 }, (_, i) => ({ at: i * 15 + 1, sound: "t1SfxPop" as const, mix: 0.5 })), // each costume
    { at: 166, sound: "t1SfxSlap", mix: 0.6 }, // SENİNKİ? slot
    END_POP,
  ],
  DRH: [
    { at: 2, sound: "t1SfxPop", mix: 0.5 }, // host Puhu
    { at: 7, sound: "t1SfxStamp", mix: 0.6 }, // Haftan hazır
    ...[45, 105, 165, 225].map((at) => ({ at, sound: "t1SfxFlick" as const, mix: 0.7 })), // tap to the next slide
    { at: 46, sound: "t1SfxStamp", mix: 0.6 }, // Odaklanınca durdurulamıyorsun
    { at: 106, sound: "t1SfxStamp", mix: 0.7 }, // 5
    { at: 167, sound: "t1SfxStamp", mix: 0.7 }, // Matematik box
    { at: 227, sound: "t1SfxChime", mix: 0.7 }, // the nickname reveal
    { at: 234, sound: "t1SfxSparkle", mix: 0.6 }, // Odak Makinesi
    endPop(300),
  ],
  DRY: [
    { at: 1, sound: "t1SfxStamp", mix: 0.7 }, // YANLIŞ MI YAPTIN?
    { at: 10, sound: "t1SfxSwish", mix: 0.8 }, // the question slides onto the page
    { at: 16, sound: "t1SfxTear", mix: 0.7 }, // tape
    { at: 61, sound: "t1SfxRustle", mix: 0.6 }, // red pen writes
    { at: 136, sound: "t1SfxStamp", mix: 0.6 }, // TEKRAR GÜNÜ GELDİ!
    { at: 140, sound: "t1SfxFlick", mix: 0.7 }, // the review tag flips in
    { at: 211, sound: "t1SfxStamp", mix: 0.8 }, // ÇÖZDÜM
    endPop(300),
  ],
};

// Each reel's music, organic and ad alike (owner, 2026-11-23: a different track per reel, in the organic reels too).
// All Pixabay Content License by NickPanek, who claims no Content ID, all on the reels' 120 BPM grid. DRP keeps T1's own track (the brand sound) from the vision-board scene; the other three
// are pre-cut clips. `gain` evens each track's loudness with T1's (measured RMS: T1 −12,9 dB).
export type DrMusic = { sound: SoundKey; from: number; gain: number };
export const DR_MUSIC: Record<DrId, DrMusic> = {
  // T1 was re-timed (62,5 s), so scene 06 no longer starts on a bar: snap down to the bar grid (60 frames).
  DRP: { sound: "t1Music", from: Math.floor(sceneOf("06").from / 60) * 60, gain: 1 },
  DRK: { sound: "d2MusicBalkan", from: 0, gain: 1.46 }, // −16,2 dB
  DRH: { sound: "d2MusicDubai", from: 0, gain: 1.23 }, // −14,7 dB
  DRY: { sound: "d2MusicRetro", from: 0, gain: 1.55 }, // −16,7 dB
};
