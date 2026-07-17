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
  bg: "#FFFFFF",
  surface: "#FFFFFF",
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
  likeActive: "#FF2DAB",
  errorContainer: "#ffdad6",
  danger: "#B42318",
  success: "#2E7D54",
  focusRing: "#1D6FBF",
} as const;

export const typography = {
  heading: "'Nunito Sans', sans-serif",
  body: "'Nunito Sans', sans-serif",
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
