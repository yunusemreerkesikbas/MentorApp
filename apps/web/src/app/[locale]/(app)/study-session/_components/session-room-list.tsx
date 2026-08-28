"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronRight, Plus } from "lucide-react";
import type { StudyRoomDto, StudyRoomTheme } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { createStudyRoom, joinStudyRoom, listStudyRooms } from "@/lib/study-rooms";
import { STUDY_ROOM_BACKDROP_SRC } from "@/lib/study-room-theme";
import { useMentorToast } from "@/lib/mentor-toast";
import { RoomCreateSheet } from "./room-create-sheet";
import { RoomSheet } from "./room-sheet";

type State =
  | { status: "loading" }
  // Feature flag off (403) or API error → the section disappears rather than showing a broken box.
  | { status: "hidden" }
  | { status: "ready"; rooms: StudyRoomDto[] };

/**
 * "Masalarım" on the /study-session idle screen. Each row previews its room's theme, so the
 * list reads as a set of places rather than a set of records — the same ground the stage uses,
 * shrunk to a swatch.
 *
 * Creating and joining open sheets instead of unfolding inline: this card lives in a 288px
 * rail, and a three-field form crammed in there was the reason the flow felt like data entry.
 */
export function SessionRoomList() {
  const t = useTranslations("session_room");
  const reduceMotion = useReducedMotion();
  const { error: showErrorToast } = useMentorToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"none" | "create" | "join">("none");

  const load = useCallback(() => {
    listStudyRooms()
      .then((rooms) => setState({ status: "ready", rooms }))
      .catch(() => setState({ status: "hidden" }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the live "kim çalışıyor" counts fresh while the list is on screen.
  const hasRooms = state.status === "ready" && state.rooms.length > 0;
  useEffect(() => {
    if (!hasRooms) return;
    const id = setInterval(() => {
      listStudyRooms()
        .then((rooms) => setState({ status: "ready", rooms }))
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [hasRooms]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setSheet("none");
      load();
    } catch (err) {
      showErrorToast({
        title: t("error_title"),
        message: err instanceof ApiClientError ? err.body.message : undefined,
        duration: 3000,
      });
    } finally {
      setBusy(false);
    }
  };

  if (state.status === "loading" || state.status === "hidden") return null;

  return (
    <Card className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("section_title")}
        </span>
        <button
          type="button"
          onClick={() => setSheet("create")}
          aria-label={t("create_action")}
          title={t("create_action")}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none motion-reduce:hover:scale-100"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-progress) 16%, transparent)",
            color: "var(--color-main)",
          }}
        >
          <Plus className="size-4" strokeWidth={2.5} aria-hidden />
        </button>
      </div>

      {state.rooms.length === 0 ? (
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-secondary)" }}>
          {t("empty")}
        </p>
      ) : (
        <motion.ul
          className="flex flex-col gap-1.5"
          initial={reduceMotion ? false : "hidden"}
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        >
          <AnimatePresence initial={false}>
            {state.rooms.map((room) => (
              <motion.li
                key={room.id}
                layout
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
                }}
                exit={{ opacity: 0, height: 0 }}
              >
                <RoomRow room={room} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {state.rooms.length === 0 ? (
          <TextAction label={t("create_action")} tone="accent" onClick={() => setSheet("create")} />
        ) : null}
        <TextAction label={t("join_action")} onClick={() => setSheet("join")} />
      </div>

      <RoomCreateSheet
        open={sheet === "create"}
        busy={busy}
        onClose={() => setSheet("none")}
        onSubmit={(input) => void run(() => createStudyRoom(input))}
      />
      <JoinSheet
        open={sheet === "join"}
        busy={busy}
        onClose={() => setSheet("none")}
        onSubmit={(code) => void run(() => joinStudyRoom(code))}
      />
    </Card>
  );
}

/**
 * Theme swatch: the actual room, cropped to 40px. It used to be a token wash with a beige
 * pill on it — a drawing of "a table" that told you nothing about which room this row was,
 * while the real photo already shipped two components away. The token drawing stays as the
 * fallback for a theme whose art has not landed yet.
 *
 * One boolean is enough here, unlike the stage and the carousel: a row's theme never changes
 * under it, so a failed src cannot come back into view.
 */
function ThemeSwatch({ theme }: { theme: StudyRoomTheme }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      className="room-stage relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
      data-room-theme={theme}
      style={{
        background:
          "radial-gradient(120% 100% at 50% 0%, var(--room-ground-from) 0%, var(--room-ground-to) 100%)",
      }}
    >
      {failed ? (
        <span
          className="h-3 w-6 rounded-[50%]"
          style={{
            backgroundColor: "var(--room-table)",
            boxShadow: "0 1px 0 var(--room-table-edge)",
          }}
        />
      ) : (
        <Image
          src={STUDY_ROOM_BACKDROP_SRC[theme]}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

function RoomRow({ room }: { room: StudyRoomDto }) {
  const t = useTranslations("session_room");
  return (
    <Link
      href={{ pathname: "/study-session/rooms/[id]", params: { id: room.id } }}
      className="group flex items-center gap-3 rounded-[var(--radius-card)] px-2 py-2 transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{ opacity: room.isActive ? 1 : 0.65 }}
    >
      <ThemeSwatch theme={room.theme} />
      <span className="min-w-0 flex-1 leading-tight">
        <span
          className="block truncate text-sm font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {room.name}
        </span>
        <span className="block truncate text-xs" style={{ color: "var(--color-secondary)" }}>
          {t(`theme_${room.theme}`)} ·{" "}
          {t("seats", { filled: room.memberCount, capacity: room.capacity })}
        </span>
      </span>
      {room.activeCount > 0 ? (
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-success) 14%, transparent)",
            color: "var(--color-success)",
          }}
        >
          <span
            aria-hidden
            className="size-1.5 rounded-full animate-pulse motion-reduce:animate-none"
            style={{ backgroundColor: "var(--color-success)" }}
          />
          {room.activeCount}
        </span>
      ) : null}
      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-60 motion-reduce:transition-none"
        style={{ color: "var(--color-secondary)" }}
      />
    </Link>
  );
}

function JoinSheet({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (code: string) => void;
}) {
  const t = useTranslations("session_room");
  const [code, setCode] = useState("");

  return (
    <RoomSheet open={open} onClose={onClose} title={t("join_action")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!code.trim() || busy) return;
          onSubmit(code.trim().toUpperCase());
        }}
        className="flex flex-col gap-4"
      >
        <input
          type="text"
          value={code}
          autoFocus
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("join_placeholder")}
          aria-label={t("join_action")}
          autoComplete="off"
          autoCapitalize="characters"
          className="min-h-14 rounded-[var(--radius-card)] border px-3 text-center text-lg font-bold tracking-[0.2em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ borderColor: "var(--color-progress-track)", color: "var(--color-main)" }}
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="min-h-12 w-full cursor-pointer rounded-full text-sm font-bold disabled:opacity-50"
          style={{ backgroundColor: "var(--color-btn)", color: "var(--color-btn-label)" }}
        >
          {t("join_submit")}
        </button>
      </form>
    </RoomSheet>
  );
}

function TextAction({
  label,
  onClick,
  tone = "quiet",
}: {
  label: string;
  onClick: () => void;
  tone?: "accent" | "quiet";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 cursor-pointer text-sm font-semibold"
      style={{ color: tone === "accent" ? "var(--color-progress)" : "var(--color-secondary)" }}
    >
      {label}
    </button>
  );
}
