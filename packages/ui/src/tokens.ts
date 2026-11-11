/**
 * @mentor/ui tokens — DESIGN.md (Nuton base + PuhuKoç Panel evolution).
 * Framework-agnostic: web (Tailwind) and mobile (React Native) use the same source.
 * Value source: DESIGN.md §2–§9.
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
  heading: "'Nunito', system-ui, sans-serif",
  body: "'Nunito', system-ui, sans-serif",
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

// ---------------------------------------------------------------------------
// DESIGN.md §1–§9 Canonical Panel & React Native Token System
// ---------------------------------------------------------------------------

export type ThemeMode = "light" | "dark";

export interface ThemePalette {
  readonly mode: ThemeMode;
  readonly bg: string;
  readonly surface: string;
  readonly surfaceAlt: string;
  readonly surfaceHover: string;
  readonly border: string;
  readonly main: string;
  readonly secondary: string;
  readonly muted: string;
  readonly ctaPlayBg: string;
  readonly ctaPlayEdge: string;
  readonly ctaPlayHover: string;
  readonly ctaPlayInk: string;
  readonly accent: string;
  readonly star: string;
  readonly streak: string;
  readonly streakSoft: string;
  readonly success: string;
  readonly successBg: string;
  readonly warning: string;
  readonly warningBg: string;
  readonly danger: string;
  readonly dangerBg: string;
  readonly dangerEdge: string;
  readonly dangerInk: string;
  readonly premiumMark: string;
  readonly premiumRingFrom: string;
  readonly premiumRingTo: string;
  readonly coachAccent: string;
  readonly coachAccentSoft: string;
  readonly scrim: string;
  readonly activityRamp: readonly [string, string, string, string, string];
}

/** DESIGN.md §2.1–§2.4 Light (Warm Daylight Paper Desk) theme palette. */
export const lightThemeTokens: ThemePalette = {
  mode: "light",
  bg: "#FAF6F0",
  surface: "#FFFFFF",
  surfaceAlt: "#F3EDE3",
  surfaceHover: "#EFE7DA",
  border: "#E6DEC8",
  main: "#111827",
  secondary: "#4B5563",
  muted: "#6B7280",
  ctaPlayBg: "#55ACEE",
  ctaPlayEdge: "#3B8FD0",
  ctaPlayHover: "#66B8F4",
  ctaPlayInk: "#0F2233",
  accent: "#F59E0B",
  star: "#FBBF24",
  streak: "#F3705A",
  streakSoft: "#FFE8E2",
  success: "#15803D",
  successBg: "#DCFCE7",
  warning: "#B45309",
  warningBg: "#FEF3C7",
  danger: "#B91C1C",
  dangerBg: "#FEE2E2",
  dangerEdge: "#8A1B12",
  dangerInk: "#FFFFFF",
  premiumMark: "#1E2A5A",
  premiumRingFrom: "#FDE68A",
  premiumRingTo: "#F59E0B",
  coachAccent: "#0D9488",
  coachAccentSoft: "#E6E9F7",
  scrim: "rgba(17, 17, 17, 0.40)",
  activityRamp: ["#EFECE6", "#FDE68A", "#FCD34D", "#FBBF24", "#F59E0B"],
} as const;

/** DESIGN.md §2.1–§2.4 Dark (Cozy Evening Lamp / Night Desk) theme palette. */
export const darkThemeTokens: ThemePalette = {
  mode: "dark",
  bg: "#0F141C",
  surface: "#171F2C",
  surfaceAlt: "#1E2838",
  surfaceHover: "#253145",
  border: "#2A364B",
  main: "#F3F6FA",
  secondary: "#A6B3C6",
  muted: "#7A889E",
  ctaPlayBg: "#55ACEE",
  ctaPlayEdge: "#3B8FD0",
  ctaPlayHover: "#66B8F4",
  ctaPlayInk: "#0F2233",
  accent: "#F59E0B",
  star: "#FBBF24",
  streak: "#F3705A",
  streakSoft: "#3A2A28",
  success: "#4ADE80",
  successBg: "#132E21",
  warning: "#FBBF24",
  warningBg: "#332611",
  danger: "#F87171",
  dangerBg: "#36181B",
  dangerEdge: "#B85A52",
  dangerInk: "#12141A",
  premiumMark: "#7E9BFF",
  premiumRingFrom: "#FDE68A",
  premiumRingTo: "#F59E0B",
  coachAccent: "#0D9488",
  coachAccentSoft: "#252B40",
  scrim: "rgba(0, 0, 0, 0.58)",
  activityRamp: ["#1E2838", "#78350F", "#B45309", "#D97706", "#FBBF24"],
} as const;

/** DESIGN.md §2.5 Scoped Scene Palettes (ignore light/dark toggle). */
export const sceneThemes = {
  landingCity: {
    nightTop: "#07122A",
    nightBottom: "#162B5B",
    lamp: "#FFE082",
    paperNote: "#FFFDF8",
  },
  roomStage: {
    LIBRARY: {
      groundFrom: "#3A2E23",
      groundTo: "#241B14",
      table: "#8B6F47",
      ink: "#F7F0E4",
      inkSoft: "#CDB99F",
      accent: "#2E7D54",
      live: "#6BC49A",
    },
    CAFE: {
      groundFrom: "#2A1F1A",
      groundTo: "#171110",
      table: "#4A3428",
      ink: "#F5EDE6",
      inkSoft: "#C2AC9C",
      accent: "#E8A87C",
      live: "#6BC49A",
    },
    HOME: {
      groundFrom: "#F3EFF9",
      groundTo: "#E3DAF1",
      table: "#7C6F97",
      ink: "#2A2438",
      inkSoft: "#5E5476",
      accent: "#55ACEE",
      live: "#2E7D54",
    },
  },
  planCoachNight: {
    sky: "#08113A",
    lamp: "#FFD15C",
    paper: "#FFFDF8",
  },
  premiumPaywall: darkThemeTokens,
} as const;

/** DESIGN.md §5 — 3-radius hierarchy + sheet & button. */
export const radii = {
  card: 20,
  button: 16,
  inner: 14,
  pill: 9999,
  sheet: 28,
} as const;

/** DESIGN.md §4 & §6 — Touch target and spacing tokens in dp/pt. */
export const touchTargets = {
  min: 44,
  comfortable: 48,
  tabBarHeight: 64,
} as const;

export const spaceScale = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
} as const;

/** DESIGN.md §6 — Tactile play-ledge metrics. */
export const ledgeTokens = {
  primaryBottomWidth: 4,
  secondaryBottomWidth: 2,
  pressTranslateY: 2,
  pressScale: 0.98,
} as const;

/** DESIGN.md §3 — Panel Type Scale (Nunito). */
export const typeScale = {
  display: { fontSize: 30, lineHeight: 35, fontWeight: "800" as const },
  title: { fontSize: 23, lineHeight: 29, fontWeight: "800" as const },
  sectionHeading: { fontSize: 17, lineHeight: 22, fontWeight: "700" as const },
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700" as const },
  body: { fontSize: 14, lineHeight: 21, fontWeight: "500" as const },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: "600" as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "600" as const },
} as const;

/** DESIGN.md §9 — Motion durations (ms) and spring parameters. */
export const motionTokens = {
  microMs: 140,
  chromeOpenMs: 240,
  chromeCloseMs: 160,
  contentMs: 280,
  springSettle: { duration: 400, dampingRatio: 1 },
  springSheet: { duration: 300, dampingRatio: 0.85 },
} as const;

export const panelTokens = {
  light: lightThemeTokens,
  dark: darkThemeTokens,
  scenes: sceneThemes,
  radii,
  touchTargets,
  space: spaceScale,
  ledge: ledgeTokens,
  typeScale,
  motion: motionTokens,
} as const;
