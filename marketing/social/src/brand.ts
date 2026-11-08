// Brand tokens for the social kit (spec: "Brand and format constraints").
export const C = {
  blue: "#2F55D4",
  yellow: "#FFE082",
  navy: "#0F2233",
  night: "#0B1636",
  nightDeep: "#07122A",
  tint: "#DCE6FF",
  tint2: "#E3EAFF",
  tintInk: "#1F3C99",
  screen: "#F4F7FF",
  cream: "#FAF6F0",
  dot: "#E6DEC8",
  paper: "#FFFDF8",
  inkBlue: "#1A5FA3",
  grey: "#4B5563",
  mutedOnNight: "#C9D4EA",
  sky: "#9CCBF5",
  // Premium (DESIGN.md §7 premium identity): hero mask night blue, its gold edge, the flight loop's ground.
  mask: "#1E2A5A",
  gold: "#F2B544",
  flight: "#020B26",
  beam: "#FFE29A",
} as const;

export const EXAMS = "KPSS · YKS · LGS · ALES · DGS";
export const SITE = "puhukoc.com";
export const HANDLE = "@puhukoc";

// latin-ext carries ı, İ, ş, ğ.
export const FONT_SUBSETS = ["latin", "latin-ext"] as const;
export const SOON = "ÇOK YAKINDA";

// Reels: TikTok's right rail and caption cover the rest (spec: "Brand and format constraints").
export const REEL_TEXT = { left: 60, right: 900, top: 250, bottom: 1500 } as const;
// Centred reel blocks sit on the frame's axis (x 540). The right rail starts at y 900, so above it they may
// span x 60–1020; below it their ink must still end by REEL_TEXT.right.
export const REEL_CENTRE = { left: 60, right: 1020, railFrom: 900 } as const;
