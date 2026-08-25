"use client";

import { useTranslations } from "next-intl";
import type { StudyRoomSeatDto, StudyRoomTheme } from "@mentor/types";
import { STUDY_ROOM_GROUND } from "@/lib/study-room-theme";
import { seatPositions } from "./room-seat-layout";
import { AuthorAvatar } from "../../community/_components/author-avatar";

/** Table ellipse, as a share of the square stage. Leaves room for avatars to sit outside it. */
const TABLE_RADIUS_X = 27;
const TABLE_RADIUS_Y = 23;
/** Seats orbit a little outside the tabletop, the way chairs stand off a real table. */
const SEAT_RADIUS_X = TABLE_RADIUS_X + 12;
const SEAT_RADIUS_Y = TABLE_RADIUS_Y + 13;

/**
 * The table and everyone around it. Seats are placed by one arc-length formula
 * ({@link seatPositions}), so any capacity from 2 to 10 lays out without a bespoke design —
 * this is what makes "kurucu koltuk sayısını seçer" cheap.
 *
 * A seat renders in one of three states: seated (avatar lit, minutes + subject), a member who
 * holds the seat but isn't working (dimmed), or an unclaimed empty chair. Effort only — the
 * subject a person chose, never a result.
 */
export function RoomSeats({
  seats,
  capacity,
  theme,
}: {
  seats: StudyRoomSeatDto[];
  capacity: number;
  theme: StudyRoomTheme;
}) {
  const t = useTranslations("session_room");
  const total = Math.max(capacity, seats.length);
  const positions = seatPositions(total, {
    radiusXPct: SEAT_RADIUS_X,
    radiusYPct: SEAT_RADIUS_Y,
  });
  const { table } = STUDY_ROOM_GROUND[theme];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm">
      {/* Tabletop. Purely decorative — the seats carry all the information. */}
      <div
        aria-hidden
        className="absolute rounded-[50%]"
        style={{
          left: `${50 - TABLE_RADIUS_X}%`,
          top: `${50 - TABLE_RADIUS_Y}%`,
          width: `${TABLE_RADIUS_X * 2}%`,
          height: `${TABLE_RADIUS_Y * 2}%`,
          backgroundColor: table,
          boxShadow: "var(--shadow-card)",
        }}
      />

      <ul className="contents">
        {positions.map((position, index) => {
          const seat = seats[index];
          return (
            <li
              key={seat?.userId ?? `empty-${index}`}
              className="absolute flex w-[26%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center"
              style={{ left: `${position.leftPct}%`, top: `${position.topPct}%` }}
            >
              {seat ? <OccupiedSeat seat={seat} /> : <EmptyChair label={t("seat_empty")} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OccupiedSeat({ seat }: { seat: StudyRoomSeatDto }) {
  const t = useTranslations("session_room");
  return (
    <>
      <span
        className="relative inline-flex rounded-full"
        style={{
          // Membership is not presence: a member who isn't working keeps their seat, quietly.
          opacity: seat.isSeated ? 1 : 0.45,
          boxShadow: seat.isSeated
            ? "0 0 0 2px color-mix(in srgb, var(--color-success) 70%, transparent)"
            : "none",
        }}
      >
        <AuthorAvatar name={seat.displayName} size={40} src={seat.avatarUrl} />
      </span>
      <span
        className="w-full truncate text-[11px] font-semibold"
        style={{ color: "var(--color-main)", opacity: seat.isSeated ? 1 : 0.6 }}
        title={seat.displayName}
      >
        {seat.displayName}
      </span>
      {seat.isSeated ? (
        <>
          <span className="w-full truncate text-[10px]" style={{ color: "var(--color-secondary)" }}>
            {t("seat_focusing", { minutes: seat.seatedMinutes ?? 0 })}
          </span>
          {seat.subject ? (
            <span
              className="w-full truncate text-[10px] font-semibold"
              style={{ color: "var(--color-progress)" }}
              title={seat.subject}
            >
              {seat.subject}
            </span>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function EmptyChair({ label }: { label: string }) {
  return (
    <>
      <span
        aria-hidden
        className="inline-block size-10 rounded-full border border-dashed"
        style={{ borderColor: "var(--color-progress-track)" }}
      />
      <span className="sr-only">{label}</span>
    </>
  );
}
