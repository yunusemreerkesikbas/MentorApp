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
} as const;

export type ArtKey = keyof typeof ART;

// Poses a reel end card may use: whole body, transparent on every edge (p2/p3 are cropped peeks).
export const END_CARD_PUHU = ["p1", "host", "wave"] as const satisfies readonly ArtKey[];
