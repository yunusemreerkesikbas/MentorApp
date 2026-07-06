/**
 * @mentor/ui tokens — taken verbatim from DESIGN.md (Nuton-based design system).
 * Framework-agnostic: web (Tailwind) and later mobile (RN) use the same source.
 * Value source: DESIGN.md §2–§5 (Figma 8lc7t0P5kibfQ7GMzLSl3l).
 */
export const colors = {
  main: "#111111", // heading/primary text/active nav
  bodyText: "#333333", // body
  secondaryText: "#666666", // caption/meta/inactive nav
  btn: "#000000", // primary button fill
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  // accent / semantic
  chip: "#BEA1FE", // used at 30% opacity
  chipText: "#7C6F97",
  progress: "#55ACEE",
  progressTrack: "#C3D9FD",
  star: "#FFC700",
  likeActive: "#FF2DAB",
  errorContainer: "#ffdad6",
  danger: "#B42318",
} as const;

export const typography = {
  heading: "'Nunito Sans', sans-serif",
  body: "'Nunito Sans', sans-serif",
} as const;

/** Uniform radius — button/field/card/chip/thumb (DESIGN.md §5). */
export const radius = "10px" as const;

/** Single shadow token (DESIGN.md §5). */
export const shadow = "0px 4px 10px rgba(37, 73, 150, 0.10)" as const;

/** 4px grid (DESIGN.md §4). */
export const spacing = [4, 8, 12, 16, 20, 24, 32] as const;
