/**
 * "Işık Yandı" choreography: the numbers both the picture (scene.mjs) and the sound (sfx.mjs)
 * read, so a chime can never drift away from the flash it belongs to.
 *
 * Scene-local seconds unless a name says otherwise. IG is the ignite moment: the student's tap,
 * or `autoIgniteAt` when nobody taps. Everything after the burst hangs off `burst = IG + windup`.
 */

export const FPS = 60;

export const CHOREO = {
  /** Night curtain wipes down from the top. */
  dusk: { start: 0, duration: 0.55 },
  /** The ✓ squashes, pops off and arcs to the stage centre. */
  spark: { launch: 0.1, land: 0.72 },
  /** The spark has become an orb; motes start spiralling in. */
  orbReady: 0.75,
  /** "Dokun, ışığı yak" pops under the orb. */
  hintAt: 1.0,
  /** Hybrid trigger: no tap → the light comes on by itself 1.5 s after the orb is ready. */
  autoIgniteAt: 2.25,
  /** IG → burst: the orb is squashed hard (anticipation). */
  windup: 0.12,
  /** burst → the badge is born out of the flash. */
  birth: 0.08,
  /** burst → the flip winds up (IG + 0.85). */
  flip: 0.73,
  flipWindup: 0.12,
  /** burst → eyebrow, title words, body, ledge. */
  eyebrow: 1.18,
  title: 1.26,
  titleStagger: 0.07,
  body: 1.56,
  ledge: 1.78,
  /** Exit, relative to the "Devam edelim" tap. */
  exit: {
    press: 0.12,
    copyOut: 0.1,
    windup: 0.14,
    launch: 0.26,
    flight: 0.62,
    curtainLift: 0.3,
    curtainDuration: 0.62,
    deckStagger: 0.09,
  },
  /** Backfill deck: card i flips at burst + deckFlip + i·deckStep, then is tossed into the fan. */
  deck: { flip: 0.7, step: 0.42, toss: 0.4 },
};

/** Spring configs, framer-motion units. Overshoot is intentional: this scene is the exception. */
export const SPRINGS = {
  badge: { stiffness: 300, damping: 16.6 }, // ≈18 % overshoot
  badgeLag: { stiffness: 300, damping: 13.5 }, // jelly: y-scale lags x-scale
  badgeRise: { stiffness: 220, damping: 20 },
  badgeTilt: { stiffness: 200, damping: 14 },
  flip: { stiffness: 300, damping: 23 }, // 180° lands near 192° and settles
  land: { stiffness: 300, damping: 12 },
  orbLand: { stiffness: 260, damping: 9 },
  title: { stiffness: 500, damping: 25 }, // ≈12 %
  ledge: { stiffness: 380, damping: 20 }, // ≈15 %
  hint: { stiffness: 420, damping: 18 },
  punch: { stiffness: 520, damping: 14 },
  pulse: { stiffness: 420, damping: 13 },
  toss: { stiffness: 210, damping: 17 },
};

/** Per-achievement light. Sampled from each badge's own art, then pushed toward saturation. */
export const LIGHT = {
  first_step: { glow: "#FFC46B", alt: "#A9C6F0" },
  route_drawn: { glow: "#6EC8FF", alt: "#FFD98A" },
  dream_space_created: { glow: "#FFB98A", alt: "#B9C6FF" },
  rhythm_found: { glow: "#FFCF7A", alt: "#8DBEFF" },
  rhythm_kept: { glow: "#FFD35C", alt: "#6FB2FF" },
  returned_to_path: { glow: "#FFBE6B", alt: "#ABC3F2" },
  route_renewed: { glow: "#7FE8C9", alt: "#7CC8FF" },
  starting_point_set: { glow: "#5FD3FF", alt: "#F9E3C4" },
  mistake_revisited: { glow: "#8EC2FF", alt: "#FFD27A" },
  week_reflected: { glow: "#C3B5FF", alt: "#FFB59A" },
  first_hello: { glow: "#FFD88A", alt: "#9FBCF7" },
  helped_someone: { glow: "#FFC970", alt: "#BED9F6" },
};

/** Copy, verbatim from apps/web/messages/tr.json (achievements.*) and the API catalogue titles. */
export const COPY = {
  eyebrow: "Yeni bir ışık yandı",
  hint: "Dokun, ışığı yak",
  cta: "Devam edelim",
  items: {
    rhythm_found: {
      title: "Ritmi Yakaladın",
      body: "Yedi gündür kendin için geri dönüyorsun. Bu artık tek bir gün değil, senin ritmin.",
    },
    first_step: {
      title: "İlk Adım",
      body: "Hazır olmayı beklemedin; ilk adımı attın. Yol şimdi senin.",
    },
    route_drawn: {
      title: "Rotanı Çizdin",
      body: "Nereye gideceğini düşünmekle kalmadın; kendine ilerleyeceğin bir rota çizdin.",
    },
    first_hello: {
      title: "İlk Merhaba",
      body: "İlk sözünü toplulukla paylaştın. Bu yolculukta artık yalnız yürümüyorsun.",
    },
  },
  history: {
    eyebrow: "Geçmiş emeklerin",
    title: "Geçmiş emeklerin de burada",
    body: (count) => `Daha önce verdiğin emeğin karşılığı olan ${count} başarı da burada.`,
  },
};

/**
 * The three films. Video seconds for `sceneStart`, `duration` and the context beats; the scene's
 * own beats are scene-local (`igniteTap`, `exitTap`).
 */
export const SCENARIOS = {
  single: {
    label: "Tek başarı · dokunarak yakma",
    theme: "light",
    duration: 10.3,
    sceneStart: 1.75,
    igniteTap: 1.95,
    exitTap: 6.45,
    achievements: ["rhythm_found"],
    origin: "node",
    context: {
      nodeTap: 0.42,
      menuOpen: 0.5,
      itemTap: 1.05,
      menuClose: 1.12,
      check: 1.2,
      flame: 1.35,
    },
  },
  deck: {
    label: "Geçmiş emekler · kendiliğinden yanma",
    theme: "dark",
    duration: 10.0,
    sceneStart: 0.6,
    igniteTap: null,
    exitTap: 7.05,
    achievements: ["first_step", "route_drawn", "first_hello"],
    origin: "horizon",
    context: null,
  },
  reduced: {
    label: "Azaltılmış hareket · prefers-reduced-motion",
    theme: "light",
    duration: 4.8,
    sceneStart: 1.4,
    igniteTap: null,
    exitTap: 2.25,
    achievements: ["rhythm_found"],
    origin: "node",
    reduced: true,
    context: {
      nodeTap: 0.42,
      menuOpen: 0.5,
      itemTap: 1.05,
      menuClose: 1.12,
      check: 1.12,
      flame: 1.12,
    },
  },
};

/** Scene-local anchors for one scenario. */
export function beatsFor(scenario) {
  const ignite = scenario.igniteTap ?? CHOREO.autoIgniteAt;
  const burst = ignite + CHOREO.windup;
  const count = scenario.achievements.length;
  const deckDone =
    count > 1 ? burst + CHOREO.deck.flip + (count - 1) * CHOREO.deck.step + 0.55 : null;
  // In the deck, the copy waits for the fan to settle instead of the single flip.
  const copyBase = deckDone ?? burst + CHOREO.eyebrow;
  return { ignite, burst, copyBase, exit: scenario.exitTap };
}

/** Audio cues in video seconds. */
export function cuesFor(scenario) {
  const cues = [];
  const at = (t, type, extra = {}) => cues.push({ t, type, ...extra });
  const s0 = scenario.sceneStart;
  const { ignite, burst, copyBase, exit } = beatsFor(scenario);
  const ctx = scenario.context;

  if (ctx) {
    at(ctx.nodeTap, "tap");
    at(ctx.itemTap, "tap");
    at(ctx.check, "check");
    at(ctx.flame, "flame");
  }

  if (scenario.reduced) {
    at(s0 + 0.05, "chime");
    at(s0 + exit, "press");
    return cues.sort((a, b) => a.t - b.t);
  }

  at(s0 + CHOREO.spark.launch - 0.04, "spark");
  at(s0 + CHOREO.orbReady, "gather", { until: s0 + ignite });
  at(s0 + CHOREO.hintAt, "pop", { gain: 0.35 });
  if (scenario.igniteTap != null) at(s0 + ignite, "tap", { gain: 0.7 });
  at(s0 + burst, "burst");
  at(s0 + burst + 0.02, "chime");

  const count = scenario.achievements.length;
  if (count === 1) {
    const flip = burst + CHOREO.flip;
    at(s0 + flip + CHOREO.flipWindup - 0.02, "swish");
    at(s0 + flip + CHOREO.flipWindup + 0.16, "land");
    // The two corner sparkles (scene.mjs cornerSparkles): top right, then bottom left.
    at(s0 + flip + 0.42, "twinkle", { pan: 0.45 });
    at(s0 + flip + 0.66, "twinkle", { pan: -0.45, gain: 0.6, pitch: 1.19 });
  } else {
    for (let i = 0; i < count; i += 1) {
      const flipAt = burst + CHOREO.deck.flip + i * CHOREO.deck.step;
      at(s0 + flipAt + CHOREO.flipWindup - 0.02, "swish", { gain: 0.8 });
      at(s0 + flipAt + CHOREO.flipWindup + 0.16, "land", { gain: 0.7, pitch: 1 + i * 0.12 });
    }
  }
  at(s0 + copyBase + 0.1, "pop", { gain: 0.45 });
  at(s0 + exit, "press");
  at(s0 + exit + CHOREO.exit.launch, "fly");
  for (let i = 0; i < count; i += 1) {
    at(
      s0 + exit + CHOREO.exit.launch + CHOREO.exit.flight + i * CHOREO.exit.deckStagger,
      "arrive",
      { gain: i === count - 1 ? 1 : 0.55, pitch: 1 + i * 0.06 },
    );
  }
  return cues.sort((a, b) => a.t - b.t);
}
