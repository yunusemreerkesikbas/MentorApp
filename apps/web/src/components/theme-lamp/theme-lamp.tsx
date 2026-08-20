"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { useTheme } from "@/lib/use-theme";
import { LampCord } from "./lamp-cord";
import { useLampChoreography } from "./use-lamp-choreography";
import {
  GLOW_FADE_MS,
  HEADER_HANG_OFFSET_PX,
  LAMP_ART,
  LAMP_LAYOUT,
  type LampVariant,
  OWL_PIVOT,
  OWL_SPRITES,
  type OwlPose,
  POSE_FADE_MS,
  isLit,
  owlArtBox,
  owlPose,
  reactionScale,
  resolveLean,
  shadeArtBox,
  trackRingStyle,
} from "./lamp-choreography";

/** Same spring as the sidebar tab pill, so the whole rail moves with one hand. */
const LEAN_SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;
const POSES: OwlPose[] = ["rest", "reach", "blink", "gazeLeft", "gazeRight"];

type LampChoreography = ReturnType<typeof useLampChoreography>;

const FOOTER_BORDER = {
  borderColor: "color-mix(in srgb, var(--color-secondary) 24%, transparent)",
} as const;

/**
 * Theme toggle as a pendant lamp hanging off the sidebar footer divider, with Puhu underneath
 * reaching for the pull cord. Dark is the lit state (see `isLit`): a warm cone on the charcoal
 * canvas. The other four toggle slots keep the plain icon button — a scene this tall has nowhere
 * to sit in the mobile header.
 *
 * Pointer tracking lives on a ring around the scene, not on the painted box: the owl is ~60px
 * wide, which is too small a field for a glance to the side. The rail keeps its own ring; the
 * expanded panel uses `ThemeLampFooter` so the whole footer (and the empty column above it)
 * drives his eyes without stealing LanguageToggle clicks.
 */
export function ThemeLamp({ variant }: { variant: LampVariant }) {
  const choreography = useLampChoreography();
  const layout = LAMP_LAYOUT[variant];

  return (
    <div
      className="mentor-theme-lamp relative"
      style={trackRingStyle(layout.trackPadding)}
      {...choreography.sceneHandlers}
    >
      <ThemeLampScene variant={variant} choreography={choreography} />
    </div>
  );
}

/**
 * Mobile header slot: `size-11` in flow (same as the old sun/moon button). The scene is pulled
 * up so the shade sits in the bar; Puhu hangs below it over the page. The bar does not grow.
 */
export function MobileThemeLamp() {
  const choreography = useLampChoreography();
  const layout = LAMP_LAYOUT.header;

  return (
    <div className="relative size-11 shrink-0">
      <div
        className="mentor-theme-lamp absolute right-0 z-[1]"
        style={{
          top: -HEADER_HANG_OFFSET_PX,
          ...trackRingStyle(layout.trackPadding),
        }}
        {...choreography.sceneHandlers}
      >
        <ThemeLampScene variant="header" choreography={choreography} />
      </div>
    </div>
  );
}

/**
 * Expanded-sidebar footer: LanguageToggle on the left, lamp on the right, and the whole row is
 * the gaze field. The track ring lives on an *inner* box — its negative margin would otherwise
 * overwrite `mt-auto` and leave the lamp floating in the column.
 */
export function ThemeLampFooter({ children }: { children: React.ReactNode }) {
  const choreography = useLampChoreography();
  const pad = LAMP_LAYOUT.panel.trackPadding;

  return (
    <div className="mt-auto border-t" style={FOOTER_BORDER}>
      <div
        className="mentor-theme-lamp relative flex items-end justify-between gap-2"
        style={trackRingStyle(pad)}
        {...choreography.sceneHandlers}
      >
        {children}
        <ThemeLampScene variant="panel" choreography={choreography} />
      </div>
    </div>
  );
}

function ThemeLampScene({
  variant,
  choreography,
}: {
  variant: LampVariant;
  choreography: LampChoreography;
}) {
  const t = useTranslations("nav");
  const { theme, toggleTheme } = useTheme();
  const {
    interaction,
    pointerLean,
    blinking,
    gaze,
    reaction,
    reduceMotion,
    playPull,
    sceneRef,
    buttonHandlers,
  } = choreography;

  const layout = LAMP_LAYOUT[variant];
  const shade = shadeArtBox(layout);
  const lit = isLit(theme);
  const lean = resolveLean(interaction, pointerLean);
  const glowFade = { duration: reduceMotion ? 0 : GLOW_FADE_MS / 1000 };

  function handleClick() {
    const next = theme === "dark" ? "light" : "dark";
    // The theme flips first and unconditionally; the pull is decoration on top of a done deal.
    toggleTheme();
    playPull(next);
  }

  return (
    <button
      ref={sceneRef}
      type="button"
      onClick={handleClick}
      aria-label={lit ? t("theme_to_light") : t("theme_to_dark")}
      aria-pressed={lit}
      title={t("theme_toggle_label")}
      className="relative block cursor-pointer rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{ width: layout.width, height: layout.height }}
      {...buttonHandlers}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: layout.shadeCentreX - layout.shadeWidth * 1.05,
          top: shade.mouthY,
          width: layout.shadeWidth * 2.1,
          height: layout.height - shade.mouthY,
          clipPath: "polygon(38% 0%, 62% 0%, 100% 100%, 0% 100%)",
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--lamp-glow) 42%, transparent), transparent 76%)",
          filter: "blur(2px)",
        }}
        initial={false}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={glowFade}
      />

      <Image
        src={LAMP_ART.shade}
        alt=""
        aria-hidden
        width={Math.round(shade.width)}
        height={Math.round(shade.height)}
        className="pointer-events-none absolute"
        style={{
          left: shade.left,
          top: shade.top,
          width: shade.width,
          height: shade.height,
        }}
      />

      <motion.span
        aria-hidden
        className="pointer-events-none absolute rounded-[50%]"
        style={{
          left: layout.shadeCentreX - layout.shadeWidth * 0.39,
          top: shade.mouthY - layout.shadeWidth * 0.17,
          width: layout.shadeWidth * 0.78,
          height: layout.shadeWidth * 0.2,
          background:
            "radial-gradient(closest-side, var(--lamp-glow), color-mix(in srgb, var(--lamp-glow) 35%, transparent) 72%, transparent)",
          filter: "blur(1.5px)",
        }}
        initial={false}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={glowFade}
      />

      <LampCord
        width={layout.width}
        height={layout.height}
        shadeCentreX={layout.shadeCentreX}
        shadeTopY={layout.shadeTopY}
        pullCordX={layout.pullCordX}
        mouthY={shade.mouthY}
        pullCordLength={layout.pullCordLength}
        pulling={interaction === "pulling"}
        reduceMotion={reduceMotion}
      />

      {layout.owl ? (
        <Owl
          box={owlArtBox(layout.owl, layout.height)}
          pose={owlPose(interaction, blinking, gaze)}
          leanX={lean.x}
          leanY={lean.y}
          tilt={lean.tilt}
          scale={reactionScale(reaction)}
          lit={lit}
          reduceMotion={reduceMotion}
          glowFade={glowFade}
        />
      ) : null}
    </button>
  );
}

function Owl({
  box,
  pose,
  leanX,
  leanY,
  tilt,
  scale,
  lit,
  reduceMotion,
  glowFade,
}: {
  box: { width: number; height: number; left: number; top: number };
  pose: OwlPose;
  leanX: number;
  leanY: number;
  tilt: number;
  scale: number;
  lit: boolean;
  reduceMotion: boolean;
  glowFade: { duration: number };
}) {
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  const layer = "pointer-events-none absolute inset-0";
  const poseFade = { duration: reduceMotion ? 0 : POSE_FADE_MS / 1000 };

  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        transformOrigin: OWL_PIVOT,
      }}
      initial={false}
      animate={{
        x: reduceMotion ? 0 : leanX,
        y: reduceMotion ? 0 : leanY,
        rotate: reduceMotion ? 0 : tilt,
        scale,
      }}
      transition={reduceMotion ? { duration: 0 } : LEAN_SPRING}
    >
      {POSES.map((candidate) => (
        <motion.span
          key={candidate}
          className={layer}
          initial={false}
          animate={{ opacity: candidate === pose ? 1 : 0 }}
          transition={poseFade}
        >
          <Image
            src={OWL_SPRITES[candidate]}
            alt=""
            width={width}
            height={height}
            className={layer}
            priority={candidate === "rest"}
          />
        </motion.span>
      ))}

      {/* Warm spill from the shade, masked to his silhouette so it never paints a rectangle. */}
      <motion.span
        className={layer}
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--lamp-glow) 80%, transparent), transparent 58%)",
          mixBlendMode: "soft-light",
          maskImage: `url(${OWL_SPRITES.rest})`,
          maskSize: "contain",
          maskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskImage: `url(${OWL_SPRITES.rest})`,
          WebkitMaskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
        }}
        initial={false}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={glowFade}
      />
    </motion.span>
  );
}
