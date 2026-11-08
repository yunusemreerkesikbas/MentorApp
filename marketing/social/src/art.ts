// Art paths under public/, used with staticFile().
export const ART = {
  p1: "art/p1-referee-whistle.png",
  p2: "art/p2-over-glasses.png",
  p3: "art/p3-wink-peek.png",
  phone: "art/phone-3d-screen-hole.png",
  mindBlown: "art/sticker-mind-blown.png",
  nightShift: "art/sticker-night-shift.png",
  facepalm: "art/sticker-facepalm.png",
  cryingLaughing: "art/sticker-crying-laughing.png",
  masa: "art/room-masa.webp",
  w2: "art/w2.webp",
  nightCity: "art/night-city.webp",
  readPuhu: "art/read-puhu.png",
  happy: "art/puhu-happy.png",
  proud: "art/puhu-proud.png",
  encouraging: "art/puhu-encouraging.png",
  night: "art/puhu-night.png",
  host: "art/puhu-host.png",
  wave: "art/puhu-wave.png",
  // Premium: masked hero (transparent) and the flight loop's first frame on its own night ground #020B26.
  premiumHero: "art/puhu-premium-hero.png",
  premiumFlight: "art/puhu-premium-flight.webp",
} as const;

export type ArtKey = keyof typeof ART;

// Video clips under public/, kept apart from ART because sharp can't read them.
export const CLIPS = {
  // 121 frames at 24 fps (5.04 s), seamless, KlingAI mark already cropped. Ground #020B26.
  premiumFlight: "art/puhu-premium-flight-loop.mp4",
  // Owner's Kling clip, 720x1280, 121 frames at 24 fps: crouch, jump out the top, hero landing (~2.2 s), pose.
  // Cream #F8F1EA, beam #F9D58E. The KlingAI mark (bottom right) is not cropped: PR1's navy floor covers it.
  premiumLanding: "art/puhu-premium-landing.mp4",
} as const;

// Poses a reel end card may use: whole body, transparent on every edge (p2/p3 are cropped peeks).
export const END_CARD_PUHU = ["p1", "host", "wave", "premiumHero"] as const satisfies readonly ArtKey[];
// Nudge (px) that puts each end-card Puhu's body axis on the frame centre (test/art.test.ts measures it).
export const END_CARD_SHIFT: Partial<Record<(typeof END_CARD_PUHU)[number], number>> = { premiumHero: -35 }; // the cape fills the left of the PNG
