/**
 * @mentor/ui tokens — DESIGN.md (Nuton base + Mentor evolve).
 * Framework-agnostic: web (Tailwind) and later mobile (RN) use the same source.
 * Value source: DESIGN.md §2–§5.
 */
export const colors = {
  main: "#111111", // heading/primary text/active nav
  bodyText: "#333333", // body
  secondaryText: "#666666", // caption/meta/inactive nav
  btn: "#000000", // primary button fill
  btnLabel: "#FFFFFF",
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  /** Chrome edges — sidebar rail, field rim (Nuton white hairline). */
  border: "#FFFFFF",
  /** Muted wells — tab rail, sidebar track, skeleton (DESIGN.md §2.2). */
  surfaceContainer: "#F0EDEC",
  // accent / semantic
  chip: "#BEA1FE", // used at 30% opacity
  chipText: "#7C6F97",
  progress: "#55ACEE",
  accent: "#55ACEE", // alias of progress
  progressTrack: "#C3D9FD",
  accentSoft: "#C3D9FD", // alias of progressTrack
  star: "#FFC700",
  /** Flame coral from web `public/img/flame.png` tip — ring/label; not danger. */
  streak: "#F3705A",
  streakCore: "#FFD15C",
  streakSoft: "#FFE8E2",
  likeActive: "#FF2DAB",
  errorContainer: "#ffdad6",
  danger: "#B42318",
  success: "#2E7D54",
  focusRing: "#1D6FBF",
} as const;

/**
 * Dark ramp (DESIGN.md §2.5). Soft charcoal — not terminal black.
 * Runtime source of truth is `html.dark` CSS vars; this mirror is for RN / non-CSS consumers.
 */
export const colorsDark = {
  main: "#F4F4F5",
  bodyText: "#D4D4D8",
  secondaryText: "#A1A1AA",
  btn: "#F4F4F5",
  btnLabel: "#12141A",
  bg: "#12141A",
  surface: "#1A1D24",
  border: "rgba(255, 255, 255, 0.10)",
  surfaceContainer: "#242833",
  chip: "#BEA1FE",
  chipText: "#C4B8E0",
  progress: "#55ACEE",
  accent: "#55ACEE",
  progressTrack: "#2C3D56",
  accentSoft: "#2C3D56",
  star: "#FFC700",
  streak: "#F3705A",
  streakCore: "#FFD15C",
  streakSoft: "#3A2A28",
  likeActive: "#FF2DAB",
  errorContainer: "#3D2422",
  danger: "#F28B82",
  success: "#6BC49A",
  focusRing: "#7EB6E8",
} as const;

export const blobs = {
  pink: "#FF2DAB",
  blue: "#9BC1FB",
  cyan: "#BDEBFF",
  pinkOpacity: 0.4,
  blueOpacity: 0.6,
  cyanOpacity: 0.6,
} as const;

export const blobsDark = {
  pink: "#FF2DAB",
  blue: "#9BC1FB",
  cyan: "#BDEBFF",
  pinkOpacity: 0.14,
  blueOpacity: 0.2,
  cyanOpacity: 0.18,
} as const;

export const typography = {
  heading: "'Plus Jakarta Sans', sans-serif",
  body: "'Plus Jakarta Sans', sans-serif",
} as const;

/** Uniform radius — button/field/card/chip/thumb (DESIGN.md §5). */
export const radius = "10px" as const;

/** Default card/field elevation (DESIGN.md §5). */
export const shadow = "0px 4px 10px rgba(37, 73, 150, 0.10)" as const;

/** Hover / elevated interactive cards — same tint family (DESIGN.md §5). */
export const shadowHover = "0px 6px 14px rgba(37, 73, 150, 0.10)" as const;

/** 4px grid (DESIGN.md §4). */
export const spacing = [4, 8, 12, 16, 20, 24, 32] as const;

/** Puhu size scale mirrored for non-web consumers (DESIGN.md §8.2). */
export const puhuSizes = { sm: 40, md: 72, lg: 120 } as const;
