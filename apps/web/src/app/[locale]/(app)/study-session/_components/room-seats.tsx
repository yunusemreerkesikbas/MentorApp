"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { StudyRoomSeatDto } from "@mentor/types";
import { seatPositions } from "./room-seat-layout";
import { AuthorAvatar } from "../../community/_components/author-avatar";

/** Tabletop ellipse, as a share of the square stage. Seats orbit just outside it. */
const TABLE_RADIUS_X = 26;
const TABLE_RADIUS_Y = 19;
const SEAT_RADIUS_X = TABLE_RADIUS_X + 13;
const SEAT_RADIUS_Y = TABLE_RADIUS_Y + 16;
/** Apparent thickness of the tabletop — the edge that makes it read as furniture. */
const TABLE_EDGE_PCT = 3.2;

/** "Yunus Emre Erkesikbaş" → "Yunus E." — a seat label, not a full record. */
function seatLabel(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? displayName;
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0)}.`;
}

/**
 * The table and everyone around it. Seats are placed by one arc-length formula
 * ({@link seatPositions}), so any capacity from 2 to 10 lays out without a bespoke design.
 *
 * A seat is a chair, not a dot: an empty one reads as furniture waiting for someone rather
 * than a dashed placeholder that looks like a rendering bug. For the owner an empty chair IS
 * the invite control — the action lives where the gap is, so the page needs no standing
 * invite card competing with the primary CTA.
 */
export function RoomSeats({
  seats,
  capacity,
  onInvite,
}: {
  seats: StudyRoomSeatDto[];
  capacity: number;
  /** Owner-only: turns every empty chair into an invite affordance. */
  onInvite?: () => void;
}) {
  const t = useTranslations("session_room");
  const total = Math.max(capacity, seats.length);
  const positions = seatPositions(total, {
    radiusXPct: SEAT_RADIUS_X,
    radiusYPct: SEAT_RADIUS_Y,
  });

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem]">
      {/* Contact shadow — grounds the table instead of letting it float. */}
      <div
        aria-hidden
        className="absolute rounded-[50%] blur-2xl"
        style={{
          left: `${50 - TABLE_RADIUS_X}%`,
          top: `${50 - TABLE_RADIUS_Y + 4}%`,
          width: `${TABLE_RADIUS_X * 2}%`,
          height: `${TABLE_RADIUS_Y * 2}%`,
          backgroundColor: "color-mix(in srgb, var(--room-table-edge) 45%, transparent)",
        }}
      />
      {/* Edge, then top: two offset ellipses give the tabletop its thickness. */}
      <div
        aria-hidden
        className="absolute rounded-[50%]"
        style={{
          left: `${50 - TABLE_RADIUS_X}%`,
          top: `${50 - TABLE_RADIUS_Y + TABLE_EDGE_PCT}%`,
          width: `${TABLE_RADIUS_X * 2}%`,
          height: `${TABLE_RADIUS_Y * 2}%`,
          backgroundColor: "var(--room-table-edge)",
        }}
      />
      <div
        aria-hidden
        className="absolute rounded-[50%]"
        style={{
          left: `${50 - TABLE_RADIUS_X}%`,
          top: `${50 - TABLE_RADIUS_Y}%`,
          width: `${TABLE_RADIUS_X * 2}%`,
          height: `${TABLE_RADIUS_Y * 2}%`,
          background:
            "radial-gradient(120% 140% at 50% 22%, color-mix(in srgb, #ffffff 16%, var(--room-table)) 0%, var(--room-table) 62%)",
        }}
      />

      <ul className="contents">
        {positions.map((position, index) => {
          const seat = seats[index];
          return (
            <li
              key={seat?.userId ?? `empty-${index}`}
              className="absolute flex w-[6.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 text-center"
              style={{ left: `${position.leftPct}%`, top: `${position.topPct}%` }}
            >
              {seat ? (
                <OccupiedSeat seat={seat} />
              ) : (
                <EmptyChair label={t("seat_empty")} inviteLabel={t("invite_seat")} onInvite={onInvite} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The chair back every seat sits against — the shape that makes an empty seat legible. */
function ChairBack({ children, dimmed }: { children: React.ReactNode; dimmed?: boolean }) {
  return (
    <span
      className="inline-flex size-14 items-center justify-center rounded-[18px] transition-opacity duration-200 motion-reduce:transition-none"
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

function OccupiedSeat({ seat }: { seat: StudyRoomSeatDto }) {
  const t = useTranslations("session_room");
  return (
    <>
      <ChairBack dimmed={!seat.isSeated}>
        <span
          className={`relative inline-flex rounded-full ${seat.isSeated ? "room-seat-live" : ""}`}
        >
          <AuthorAvatar name={seat.displayName} size={40} src={seat.avatarUrl} />
        </span>
      </ChairBack>
      <span
        className="w-full truncate text-[13px] font-semibold"
        style={{ color: "var(--room-ink)", opacity: seat.isSeated ? 1 : 0.65 }}
        title={seat.displayName}
      >
        {seatLabel(seat.displayName)}
      </span>
      {seat.isSeated ? (
        <span
          className="w-full truncate text-[11px] font-medium tabular-nums"
          style={{ color: "var(--room-accent)" }}
          title={seat.subject ?? undefined}
        >
          {seat.subject ?? t("seat_focusing_short", { minutes: seat.seatedMinutes ?? 0 })}
        </span>
      ) : (
        <span className="w-full truncate text-[11px]" style={{ color: "var(--room-ink-soft)" }}>
          {t("seat_idle")}
        </span>
      )}
    </>
  );
}

function EmptyChair({
  label,
  inviteLabel,
  onInvite,
}: {
  label: string;
  inviteLabel: string;
  onInvite?: () => void;
}) {
  const chair = (
    <ChairBack dimmed>
      {onInvite ? (
        <Plus className="size-5" strokeWidth={2.5} style={{ color: "var(--room-ink-soft)" }} aria-hidden />
      ) : null}
    </ChairBack>
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
      className="flex cursor-pointer flex-col items-center gap-1.5 rounded-[18px] opacity-70 transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--room-accent)] motion-reduce:transition-none"
    >
      {chair}
      <span className="text-[11px] font-semibold" style={{ color: "var(--room-ink-soft)" }}>
        {inviteLabel}
      </span>
    </button>
  );
}
