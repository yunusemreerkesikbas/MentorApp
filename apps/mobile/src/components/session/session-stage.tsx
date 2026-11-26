import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import type { StudyRoomTheme } from "@mentor/types";
import { cardShadow, mixHex } from "../../lib/layout.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

export type SessionStagePhase = "idle" | "focus" | "break" | "done";

import roomLibraryBg from "../../../../web/public/img/seans-theme/room-library-bg.webp";
import roomCafeBg from "../../../../web/public/img/seans-theme/room-cafe-bg.webp";
import roomHomeBg from "../../../../web/public/img/seans-theme/room-home-bg.webp";

/** Room photographs, shared with the web (`/img/seans-theme`). */
export const ROOM_BACKDROP = {
  LIBRARY: roomLibraryBg,
  CAFE: roomCafeBg,
  HOME: roomHomeBg,
} as const satisfies Record<StudyRoomTheme, number>;

/** The web's `STAGE_ROOM_VEIL`: how much of the room's own veil each phase draws. */
const ROOM_VEIL: Record<SessionStagePhase, number> = { idle: 0.58, focus: 0.86, break: 0.44, done: 0.74 };
/** The plain view's dark theatre (`.session-focus-theme`), used while a session runs. */
const THEATRE = { bg: "#12141A", ink: "#F4F4F5", inkSoft: "#A1A1AA" };
const BRAND_BLUE = "#55ACEE";

/**
 * Colours the session chrome reads. On a room (or the plain view's dark theatre) it is the
 * web's liquid glass over the photo with the room's ink; on the plain setup screen it is the
 * app's own surfaces, so the setup page looks like the rest of the app.
 */
export interface StageLook {
  scenic: boolean;
  ink: string;
  inkSoft: string;
  glass: string;
  glassBorder: string;
  /** A selected pill on glass: near-white with dark ink, like the web's obsidian button. */
  selected: string;
  selectedInk: string;
  track: string;
  progress: string;
  live: string;
  /** Behind the sheet-free done card. */
  card: string;
}

const StageLookContext = createContext<StageLook | null>(null);

export function useStageLook(): StageLook {
  const look = useContext(StageLookContext);
  if (!look) throw new Error("useStageLook must be used within <SessionStage>");
  return look;
}

export function SessionStage({
  phase,
  theme,
  children,
}: {
  phase: SessionStagePhase;
  /** The room on screen, or null for the plain view. */
  theme: StudyRoomTheme | null;
  children: ReactNode;
}) {
  const { palette, scenes } = useThemeTokens();
  const running = phase !== "idle";
  const room = theme ? scenes.roomStage[theme] : null;
  const veil = useRef(new Animated.Value(ROOM_VEIL[phase])).current;
  const theatre = useRef(new Animated.Value(running ? 1 : 0)).current;

  useEffect(() => {
    // The house lights: thicker veil when the focus starts, lighter for the break.
    Animated.timing(veil, { toValue: ROOM_VEIL[phase], duration: 500, useNativeDriver: true }).start();
    Animated.timing(theatre, { toValue: running ? 1 : 0, duration: 500, useNativeDriver: true }).start();
  }, [phase, running, theatre, veil]);

  const look: StageLook = room
    ? stageLook(room.ink, room.inkSoft, theme === "HOME", room.live)
    : running
      ? stageLook(THEATRE.ink, THEATRE.inkSoft, false, "#6BC49A")
      : {
          scenic: false,
          ink: palette.main,
          inkSoft: palette.secondary,
          glass: palette.surface,
          glassBorder: mixHex(palette.progress, palette.surface, 0.26),
          selected: palette.playSelected,
          selectedInk: palette.playSelectedInk,
          track: palette.progressTrack,
          progress: palette.progress,
          live: palette.success,
          card: palette.surface,
        };

  return (
    <View style={[styles.fill, { backgroundColor: room ? room.groundTo : palette.bg }]}>
      {room && theme ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={ROOM_BACKDROP[theme]} contentFit="cover" style={StyleSheet.absoluteFill}
            transition={250} accessible={false} />
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: room.veil, opacity: veil }]} />
        </View>
      ) : (
        // ponytail: the web's session-focus-bg.webp is not in the repo (404 there too); plain dark theatre.
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: theatre, backgroundColor: THEATRE.bg }]}
          pointerEvents="none" />
      )}
      <StageLookContext.Provider value={look}>{children}</StageLookContext.Provider>
    </View>
  );
}

/** The web's `session-liquid-card`: frosted glass on a room, the app's card on the plain page. */
export function StageCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const look = useStageLook();
  const { radii, space } = useThemeTokens();
  return (
    <View style={[cardShadow, {
      gap: space.md, padding: space.lg, borderRadius: radii.card, borderWidth: 1,
      backgroundColor: look.scenic ? look.card : look.glass, borderColor: look.glassBorder,
    }]}>
      <View style={styles.cardHead}>
        <AppText accessibilityRole="header" variant="cardTitle" style={{ color: look.ink, flexShrink: 1 }}>{title}</AppText>
        {action}
      </View>
      {children}
    </View>
  );
}

function stageLook(ink: string, inkSoft: string, bright: boolean, live: string): StageLook {
  return {
    scenic: true,
    ink,
    inkSoft,
    // HOME is a pale room: its glass is mostly paper so the dark ink reads (theme.css).
    glass: bright ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.16)",
    glassBorder: bright ? "rgba(42,36,56,0.14)" : "rgba(255,255,255,0.28)",
    selected: "rgba(255,255,255,0.92)",
    selectedInk: "#0F2233",
    track: bright ? "rgba(42,36,56,0.16)" : "rgba(255,255,255,0.22)",
    progress: BRAND_BLUE,
    live,
    card: bright ? "rgba(255,255,255,0.84)" : "rgba(26,20,15,0.72)",
  };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 28 },
});
