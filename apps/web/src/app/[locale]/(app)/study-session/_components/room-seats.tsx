"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { StudyRoomSeatDto, StudyRoomTheme } from "@mentor/types";
import { seatPositions } from "./room-seat-layout";
import { STUDY_ROOM_SEAT_SRC, STUDY_ROOM_TABLE_SRC } from "@/lib/study-room-theme";
import { AuthorAvatar } from "../../community/_components/author-avatar";

/** Below this the room is taller than it is wide, so the table stands on its end. */
const PORTRAIT_QUERY = "(max-width: 639px)";
/** Where the chair reaches its full 112px and the avatar can grow with it. */
const WIDE_QUERY = "(min-width: 1024px)";

/**
 * Avatar diameter per chair size (64 / 80 / 112px). Roughly half the chair: smaller and the
 * face is a thumbnail lost in upholstery — which is what a flat 40px looked like once the
 * chair grew — larger and the chair stops reading as furniture behind a person.
 */
const AVATAR_PX = { portrait: 34, base: 44, wide: 60 } as const;

/**
 * Table box and seat ellipse, as a share of the square stage.
 *
 * `portrait` is the same room turned 90°, not a second design: a phone has height to spare and
 * no width, so the table stands on its end and the seats file down its long sides — which is
 * how a narrow reading desk is actually used. The seat ellipse always clears the table by
 * enough to fit a chair plus its label; those numbers are clearance, not taste.
 *
 * `tableBox` is a SQUARE, because the artwork is square (1254×1254 with the oval drawn inside
 * it). Sizing the box to the oval's own proportions looked right on paper and was the reason
 * the table kept reading as a doll's-house piece: `object-contain` fits a square image into a
 * wide box by its SHORT side, so a 60%×44% box rendered the artwork at 44% — the width was
 * doing nothing. A square box renders it at exactly `tableBox`, and the oval inside comes out
 * that wide.
 */
const LAYOUT = {
  landscape: { tableBox: 66, fallbackX: 33, fallbackY: 24, seatX: 43, seatY: 38, rotated: false },
  portrait: { tableBox: 64, fallbackX: 23, fallbackY: 32, seatX: 31, seatY: 44, rotated: true },
} as const;

/** Apparent thickness of the CSS-fallback tabletop — the edge that makes it read as furniture. */
const TABLE_EDGE_PCT = 3.2;

/** "Yunus Emre Erkesikbaş" → "Yunus E." — a seat label, not a full record. */
function seatLabel(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? displayName;
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0)}.`;
}

/**
 * The table and everyone around it. Seats are placed by one arc-length formula
 * ({@link seatPositions}), so any capacity from 2 to 10 lays out without a bespoke design —
 * and that same math is why the table and chairs are each a SINGLE image per theme rather
 * than per-capacity art: a real table seats 2 or 10 just by how close the chairs sit, and a
 * chair viewed from directly above needs no rotation if it has no facing direction to begin
 * with (the generation prompt asked for exactly that: radially symmetric, no armrests).
 *
 * That top-down framing is also what makes the phone layout free: rotating a table seen from
 * directly above is physically meaningful in a way rotating a perspective shot is not, so the
 * portrait room reuses the landscape asset at `rotate(90deg)` instead of needing its own art.
 *
 * A seat is a chair, not a dot: an empty one reads as furniture waiting for someone rather
 * than a dashed placeholder that looks like a rendering bug. For the owner an empty chair IS
 * the invite control — the action lives where the gap is, so the page needs no standing
 * invite card competing with the primary CTA.
 */
export function RoomSeats({
  seats,
  capacity,
  theme,
  onInvite,
}: {
  seats: StudyRoomSeatDto[];
  capacity: number;
  theme: StudyRoomTheme;
  /** Owner-only: turns every empty chair into an invite affordance. */
  onInvite?: () => void;
}) {
  const t = useTranslations("session_room");
  const reduceMotion = useReducedMotion();

  /**
   * Which artwork 404'd, tracked BY SOURCE rather than as one "images failed" flag.
   *
   * The flag version had a bug you could only hit by staying on the page: switching to a theme
   * whose art has not shipped yet flipped it, and switching back never flipped it off — so the
   * library kept rendering the CSS fallback ellipse until a reload remounted the component.
   * Keyed by src, a theme with art is unaffected by a theme without, and a src that failed is
   * never re-requested.
   */
  const [failedSrc, setFailedSrc] = useState<readonly string[]>([]);
  const markFailed = (src: string) =>
    setFailedSrc((prev) => (prev.includes(src) ? prev : [...prev, src]));

  const [portrait, setPortrait] = useState(false);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    // Starts `false` and corrects after mount rather than reading `matchMedia` during render:
    // the server has no viewport, and guessing one produces a hydration mismatch. The chair's
    // own size is pure CSS; only the avatar needs the breakpoint in JS, because it is a pixel
    // prop on a shared component rather than a class.
    const queries = [
      [window.matchMedia(PORTRAIT_QUERY), setPortrait] as const,
      [window.matchMedia(WIDE_QUERY), setWide] as const,
    ];
    const cleanups = queries.map(([mq, set]) => {
      const sync = () => set(mq.matches);
      sync();
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    });
    return () => cleanups.forEach((off) => off());
  }, []);

  const layout = portrait ? LAYOUT.portrait : LAYOUT.landscape;
  const avatarPx = wide ? AVATAR_PX.wide : portrait ? AVATAR_PX.portrait : AVATAR_PX.base;
  const tableSrc = STUDY_ROOM_TABLE_SRC[theme];
  const seatSrc = STUDY_ROOM_SEAT_SRC[theme];
  const seatImageFailed = failedSrc.includes(seatSrc);
  const total = Math.max(capacity, seats.length);
  const positions = seatPositions(total, {
    radiusXPct: layout.seatX,
    radiusYPct: layout.seatY,
  });

  return (
    <motion.div
      // The stage is square, so a width-only cap left a doll's-house table adrift in a
      // full-bleed room on anything wider than a phone. `min(…, 78vh)` lets it grow with
      // whichever dimension actually runs out first. Square in both orientations on purpose:
      // `seatPositions` measures arc length with x and y in the same unit, which is exact only
      // when a percentage of width and a percentage of height are the same number of pixels.
      className="relative mx-auto aspect-square w-full max-w-[min(46rem,78vh)]"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {failedSrc.includes(tableSrc) ? (
        <TableFallback radiusX={layout.fallbackX} radiusY={layout.fallbackY} />
      ) : (
        <TableImage src={tableSrc} layout={layout} onError={() => markFailed(tableSrc)} />
      )}

      <ul className="contents">
        {positions.map((position, index) => {
          const seat = seats[index];
          return (
            <motion.li
              key={seat?.userId ?? `empty-${index}`}
              className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 text-center sm:w-[7.5rem]"
              style={{ left: `${position.leftPct}%`, top: `${position.topPct}%` }}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              // Seats land around the table in order, so arriving at a room reads as the room
              // filling rather than a grid appearing.
              transition={{ duration: 0.3, delay: 0.12 + index * 0.05, ease: "easeOut" }}
            >
              {seat ? (
                <OccupiedSeat
                  seat={seat}
                  src={seatSrc}
                  avatarPx={avatarPx}
                  imageFailed={seatImageFailed}
                  onImageError={() => markFailed(seatSrc)}
                />
              ) : (
                <EmptyChair
                  src={seatSrc}
                  imageFailed={seatImageFailed}
                  onImageError={() => markFailed(seatSrc)}
                  label={t("seat_empty")}
                  inviteLabel={t("invite_seat")}
                  onInvite={onInvite}
                />
              )}
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}

type Layout = (typeof LAYOUT)[keyof typeof LAYOUT];

/**
 * The tabletop illustration, sized to the layout's square table box.
 *
 * Portrait rooms rotate the same asset rather than shipping a second one — the view is
 * straight top-down, so turning a table is physically meaningful in a way it would not be on a
 * perspective shot. A square box means the rotation costs nothing: the footprint before and
 * after is identical, only the oval inside stands up.
 */
function TableImage({
  src,
  layout,
  onError,
}: {
  src: string;
  layout: Layout;
  onError: () => void;
}) {
  const side = layout.tableBox;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: `${50 - side / 2}%`,
        top: `${50 - side / 2}%`,
        width: `${side}%`,
        height: `${side}%`,
        transform: layout.rotated ? "rotate(90deg)" : undefined,
      }}
    >
      {/* `object-contain`, not `-cover`: the box above is a layout convenience, not the
          asset's real proportions, so the image is never stretched to fill it. Its own
          baked-in contact shadow (from the generation prompt) is the only grounding — no
          CSS shadow stacked under it, that would just double up and go muddy. */}
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 1024px) 736px, 100vw"
        className="object-contain"
        onError={onError}
      />
    </div>
  );
}

/** CSS-drawn tabletop — used only when the theme has no table illustration (yet), or it 404s. */
function TableFallback({ radiusX, radiusY }: { radiusX: number; radiusY: number }) {
  const box = {
    left: `${50 - radiusX}%`,
    width: `${radiusX * 2}%`,
    height: `${radiusY * 2}%`,
  };
  return (
    <>
      {/* Contact shadow — grounds the table instead of letting it float. `aria-hidden` only
          removes this from the a11y tree; without `pointer-events-none` a large transparent/
          blurred box like this still wins the hit-test over whatever it happens to overlap. */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-[50%] blur-2xl"
        style={{
          ...box,
          top: `${50 - radiusY + 4}%`,
          backgroundColor: "color-mix(in srgb, var(--room-table-edge) 45%, transparent)",
        }}
      />
      {/* Edge, then top: two offset ellipses give the tabletop its thickness. */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-[50%]"
        style={{
          ...box,
          top: `${50 - radiusY + TABLE_EDGE_PCT}%`,
          backgroundColor: "var(--room-table-edge)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-[50%]"
        style={{
          ...box,
          top: `${50 - radiusY}%`,
          background:
            "radial-gradient(120% 140% at 50% 22%, color-mix(in srgb, #ffffff 16%, var(--room-table)) 0%, var(--room-table) 62%)",
        }}
      />
    </>
  );
}

/**
 * The chair a seat sits against — real illustration when the theme has one, a flat rounded
 * capsule otherwise. Same asset at every position around the table: it was generated radially
 * symmetric (no armrests, no directional backrest) specifically so it never needs rotating.
 */
function ChairFrame({
  src,
  dimmed,
  imageFailed,
  onImageError,
  children,
}: {
  src: string;
  dimmed?: boolean;
  imageFailed: boolean;
  onImageError: () => void;
  children?: React.ReactNode;
}) {
  if (imageFailed) {
    return (
      <span
        className="inline-flex size-12 items-center justify-center rounded-[18px] transition-opacity duration-200 sm:size-14 lg:size-[4.5rem] motion-reduce:transition-none"
        style={{
          backgroundColor: "var(--room-chair)",
          boxShadow: "0 2px 6px color-mix(in srgb, var(--room-table-edge) 35%, transparent)",
          opacity: dimmed ? 0.55 : 1,
        }}
      >
        {children}
      </span>
    );
  }
  // The chair and the avatar are sized together (see `AVATAR_PX`): a chair wide enough to
  // read as furniture around a person, and a face big enough to recognise from across the
  // room. Pinning the avatar at the app-wide 40px was the mistake — it is a person here, not
  // a byline. A phone gets 64px chairs back: ten of them have to fit around a 335px stage.
  return (
    <span
      className="relative inline-flex size-16 items-center justify-center transition-opacity duration-200 sm:size-20 lg:size-28 motion-reduce:transition-none"
      style={{ opacity: dimmed ? 0.55 : 1 }}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 1024px) 112px, (min-width: 640px) 80px, 64px"
        className="pointer-events-none object-contain"
        onError={onImageError}
      />
      <span className="relative">{children}</span>
    </span>
  );
}

function OccupiedSeat({
  seat,
  src,
  avatarPx,
  imageFailed,
  onImageError,
}: {
  seat: StudyRoomSeatDto;
  src: string;
  avatarPx: number;
  imageFailed: boolean;
  onImageError: () => void;
}) {
  const t = useTranslations("session_room");
  return (
    <>
      <ChairFrame
        src={src}
        dimmed={!seat.isSeated}
        imageFailed={imageFailed}
        onImageError={onImageError}
      >
        <span
          className={`relative inline-flex rounded-full ${seat.isSeated ? "room-seat-live" : ""}`}
        >
          <AuthorAvatar name={seat.displayName} size={avatarPx} src={seat.avatarUrl} />
        </span>
      </ChairFrame>
      <span
        className="w-full truncate text-xs font-semibold sm:text-sm"
        // Halo in the room's own ground colour — dark on a dim library, light on a bright
        // home — so a name stays readable wherever it lands on a busy illustration.
        style={{
          color: "var(--room-ink)",
          opacity: seat.isSeated ? 1 : 0.7,
          textShadow: "0 1px 3px var(--room-ground-to)",
        }}
        title={seat.displayName}
      >
        {seatLabel(seat.displayName)}
      </span>
      {seat.isSeated ? (
        <span
          className="w-full truncate text-[11px] font-semibold tabular-nums sm:text-xs"
          style={{ color: "var(--room-accent)", textShadow: "0 1px 3px var(--room-ground-to)" }}
          title={seat.subject ?? undefined}
        >
          {seat.subject ?? t("seat_focusing_short", { minutes: seat.seatedMinutes ?? 0 })}
        </span>
      ) : (
        <span
          className="w-full truncate text-[11px] font-medium sm:text-xs"
          style={{ color: "var(--room-ink-soft)", textShadow: "0 1px 3px var(--room-ground-to)" }}
        >
          {t("seat_idle")}
        </span>
      )}
    </>
  );
}

function EmptyChair({
  src,
  imageFailed,
  onImageError,
  label,
  inviteLabel,
  onInvite,
}: {
  src: string;
  imageFailed: boolean;
  onImageError: () => void;
  label: string;
  inviteLabel: string;
  onInvite?: () => void;
}) {
  const chair = (
    <ChairFrame src={src} dimmed imageFailed={imageFailed} onImageError={onImageError}>
      {onInvite ? (
        <Plus className="size-5" strokeWidth={2.5} style={{ color: "var(--room-ink-soft)" }} aria-hidden />
      ) : null}
    </ChairFrame>
  );

  if (!onInvite) {
    return (
      <>
        {chair}
        <span className="sr-only">{label}</span>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={onInvite}
      // The gap is the affordance: the owner invites from the empty seat itself.
      className="flex cursor-pointer flex-col items-center gap-1.5 rounded-[18px] opacity-85 transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--room-accent)] motion-reduce:transition-none"
    >
      {chair}
      <span
        className="text-[11px] font-semibold sm:text-xs"
        style={{ color: "var(--room-ink-soft)", textShadow: "0 1px 3px var(--room-ground-to)" }}
      >
        {inviteLabel}
      </span>
    </button>
  );
}
