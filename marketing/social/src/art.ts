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
  // Feature ads ("Puhu iş başında"): Higgsfield renders, keyed with art-source.local/social/tools.
  koruma: "art/b1-koruma.png",
  navigasyon: "art/b2-navigasyon.png",
  dedektif: "art/b3-dedektif.png",
  hava: "art/b4-hava.png",
  // Premium: masked hero (transparent) and the flight loop's first frame on its own night ground #020B26.
  premiumHero: "art/puhu-premium-hero.png",
  premiumFlight: "art/puhu-premium-flight.webp",
  // T1 (promo film), copied from the app. Career Puhus: 320 px squares on white (the sticker card).
  t1CareerSaglik: "art/t1/career-saglik.webp",
  t1CareerMuhendislik: "art/t1/career-muhendislik.webp",
  t1CareerHukuk: "art/t1/career-hukuk.webp",
  t1CareerYazilim: "art/t1/career-yazilim.webp",
  t1CareerEgitim: "art/t1/career-egitim.webp",
  t1CareerIsletme: "art/t1/career-isletme.webp",
  t1CareerSosyal: "art/t1/career-sosyal.webp",
  t1CareerSanat: "art/t1/career-sanat.webp",
  t1CareerFen: "art/t1/career-fen.webp",
  t1CareerMimarlik: "art/t1/career-mimarlik.webp",
  // Vision board photos (landing board, 1254 px squares).
  t1Board1: "art/t1/board-v1-kampus.webp",
  t1Board2: "art/t1/board-v2-kod.webp",
  t1Board3: "art/t1/board-v3-konya.webp",
  t1Board4: "art/t1/board-v4-mezuniyet.webp",
  // Landing city: the lit apartment facade and the three night layers.
  t1Facade: "art/t1/city-facade.webp",
  t1CityFar: "art/t1/city-far.webp",
  t1CityMid: "art/t1/city-mid.webp",
  t1CityFront: "art/t1/city-front.webp",
  // Seans rooms: the floor fills the screen, the table sits in the timer ring.
  t1RoomHomeBg: "art/t1/room-home-bg.webp",
  t1RoomHomeTable: "art/t1/room-home-table.webp",
  t1RoomCafeBg: "art/t1/room-cafe-bg.webp",
  t1RoomCafeTable: "art/t1/room-cafe-table.webp",
  t1RoomLibraryBg: "art/t1/room-library-bg.webp",
  t1RoomLibraryTable: "art/t1/room-library-table.webp",
  // Defterlerim desk Puhu (360 px) and the peek over the book.
  t1DeskPuhuLeft: "art/t1/desk-puhu-left.webp",
  t1DeskPuhuRight: "art/t1/desk-puhu-right.webp",
  t1DeskPuhuBlink: "art/t1/desk-puhu-blink.webp",
  t1DeskPuhuPeek: "art/t1/desk-puhu-peek.png",
  // Weekly chest: open chest (384 px, transparent) and the closed desk scene (the clip's first frame).
  t1ChestOpen: "art/t1/chest-open.webp",
  t1DeskChestClosed: "art/t1/desk-chest-closed-tall.webp",
  // Weekly nickname characters (941x1672): Odak Makinesi, Seri Canavarı, Korkusuz Denemeci.
  t1CharFocus: "art/t1/char-nebula-diver.png",
  t1CharStreak: "art/t1/char-time-bender.png",
  t1CharBrave: "art/t1/char-phoenix-pilot.png",
  // Real app screens for frame 08 (1134x2466, 378x822 @3x): /plan and the deneme result on /analiz, local web
  // app with mocked demo data ("Deniz", no real user). Raw captures in art-source.local/social/promo/screens.
  t1ScreenPlan: "art/t1/screen-plan.png",
  t1ScreenDeneme: "art/t1/screen-deneme.png",
} as const;

export type ArtKey = keyof typeof ART;

// Video clips under public/, kept apart from ART because sharp can't read them.
export const CLIPS = {
  // 121 frames at 24 fps (5.04 s), seamless, KlingAI mark already cropped. Ground #020B26.
  premiumFlight: "art/puhu-premium-flight-loop.mp4",
  // Owner's Kling clip, 720x1280, 121 frames at 24 fps: crouch, jump out the top, hero landing (~2.2 s), pose.
  // Cream #F8F1EA, beam #F9D58E. The KlingAI mark (bottom right) is not cropped: PR1's navy floor covers it.
  premiumLanding: "art/puhu-premium-landing.mp4",
  // T1 Kling clips (owner, 2026-11-10): 720x1280, 24 fps, 5.04 s, audio muted. KlingAI mark at y 96–98 %,
  // x 78–96 %; ClipScene's 6 % top-centre scale pushes it out of frame.
  t1K1: "art/t1/promo-K1.mp4",
  t1K3: "art/t1/promo-K3.mp4",
  t1K4: "art/t1/promo-K4.mp4",
  t1K5: "art/t1/promo-K5.mp4",
  // The app's clips: "Şehrin üstünde" magic loop (720², 4.2 s, ground ~#0E0F26) and the tall chest (mark cropped).
  t1Magic: "art/t1/puhu-hero-magic-loop.mp4",
  t1Chest: "art/t1/chest-open-tall.mp4",
} as const;

// Audio under public/: T1's music, the Igloo cut (120 BPM, 62 s; source and bar map in the spec).
export const SOUND = {
  t1Music: "audio/t1-music.mp3",
  // T1 effects, Pixabay Content License; sources in art-source.local/social/gen/sfx-sources.md.
  t1SfxPing: "sfx/ping.mp3",
  t1SfxWhoosh: "sfx/whoosh.mp3",
  t1SfxBlop: "sfx/blop.mp3",
  t1SfxStamp: "sfx/stamp.mp3",
  t1SfxPop: "sfx/pop.mp3",
  t1SfxSlap: "sfx/slap.mp3",
  t1SfxTear: "sfx/tear.mp3",
  t1SfxPin: "sfx/pin.mp3",
  t1SfxSparkle: "sfx/sparkle.mp3",
  t1SfxSwish: "sfx/swish.mp3",
  t1SfxClick: "sfx/click.mp3",
  t1SfxRustle: "sfx/rustle.mp3",
  t1SfxThump: "sfx/thump.mp3",
  t1SfxPage: "sfx/page.mp3",
  t1SfxClap: "sfx/clap.mp3",
  t1SfxLid: "sfx/lid.mp3",
  t1SfxChime: "sfx/chime.mp3",
  t1SfxFlick: "sfx/flick.mp3",
  t1SfxSnap: "sfx/snap.mp3",
  t1SfxSwitch: "sfx/switch.mp3",
} as const;

// Poses a reel end card may use: whole body, transparent on every edge (p2/p3 are cropped peeks).
export const END_CARD_PUHU = ["p1", "host", "wave", "premiumHero", "koruma"] as const satisfies readonly ArtKey[];
// Nudge (px) that puts each end-card Puhu's body axis on the frame centre (test/art.test.ts measures it).
export const END_CARD_SHIFT: Partial<Record<(typeof END_CARD_PUHU)[number], number>> = { premiumHero: -35 }; // the cape fills the left of the PNG
