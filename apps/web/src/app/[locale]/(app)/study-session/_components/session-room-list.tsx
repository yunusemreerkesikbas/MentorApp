"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight, Plus } from "lucide-react";
import type { StudyRoomDto, StudyRoomTheme } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Skeleton, SkeletonGroup, TextField } from "@mentor/ui";
import {
  PANEL_CARD_TITLE,
  PANEL_QUIET_LINK,
  PANEL_TEXT_LINK,
} from "@/components/panel/panel-styles";
import { PuhuImage } from "@/components/puhu-image";
import { Link } from "@/i18n/navigation";
import {
  createStudyRoom,
  joinStudyRoom,
  listStudyRooms,
  studyRoomJoinFailure,
} from "@/lib/study-rooms";
import { STUDY_ROOM_BACKDROP_SRC } from "@/lib/study-room-theme";
import { useMentorToast } from "@/lib/mentor-toast";
import { RoomCreateSheet } from "./room-create-sheet";
import { RoomSheet } from "./room-sheet";
import { SESSION_CARD_CLASS } from "./session-today-card";

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
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const { error: showErrorToast } = useMentorToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const searchParams = useSearchParams();
  // `?katil=1` comes from "Kodu elle gir" on an invite that failed: open the join sheet once, and
  // take the flag out of the address so a reload does not open it again.
  const [sheet, setSheet] = useState<"none" | "create" | "join">(() =>
    searchParams.get("katil") === "1" ? "join" : "none",
  );
  const askedToJoin = searchParams.get("katil") === "1";
  useEffect(() => {
    if (!askedToJoin) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("katil");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [askedToJoin]);

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

  if (state.status === "hidden") return null;
  if (state.status === "loading") return <SessionRoomListSkeleton />;

  const empty = state.rooms.length === 0;

  return (
    <section className={`${SESSION_CARD_CLASS} gap-2`} aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId} className={PANEL_CARD_TITLE}>
          {t("section_title")}
        </h2>
        {empty ? null : (
          <button
            type="button"
            onClick={() => setSheet("create")}
            aria-label={t("create_action")}
            title={t("create_action")}
            className="-my-2.5 -mr-2.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-main)] transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          >
            <Plus className="size-[22px]" strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>

      {empty ? (
        // First visit: Puhu says what a table is for; the two ways in sit right under it.
        <div className="flex items-center gap-3 py-1">
          <PuhuImage variant="encouraging" size={56} className="shrink-0" />
          <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("empty")}</p>
        </div>
      ) : (
        <motion.ul
          className="flex flex-col"
          initial={reduceMotion ? false : "hidden"}
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        >
          <AnimatePresence initial={false}>
            {state.rooms.map((room, index) => (
              <motion.li
                key={room.id}
                layout
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
                }}
                exit={{ opacity: 0, height: 0 }}
                className={index > 0 ? "border-t border-[var(--play-line)]" : undefined}
              >
                <RoomRow room={room} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <div className="flex flex-wrap items-center gap-x-[18px]">
        {empty ? (
          <button type="button" onClick={() => setSheet("create")} className={PANEL_TEXT_LINK}>
            {t("create_action")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setSheet("join")}
          className={empty ? PANEL_QUIET_LINK : PANEL_TEXT_LINK}
        >
          {t("join_action")}
        </button>
      </div>

      {/* Mounted only while open, so every visit starts with an empty form. */}
      {sheet === "create" ? (
        <RoomCreateSheet
          open
          busy={busy}
          onClose={() => setSheet("none")}
          onSubmit={(input) => void run(() => createStudyRoom(input))}
        />
      ) : null}
      {sheet === "join" ? (
        <JoinSheet
          onClose={() => setSheet("none")}
          onJoin={async (code) => {
            await joinStudyRoom(code);
            setSheet("none");
            load();
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * Theme swatch: the actual room, cropped to 44px. It used to be a token wash with a beige
 * pill on it — a drawing of "a table" that told you nothing about which room this row was,
 * while the real photo already shipped two components away. The token drawing stays as the
 * fallback for a theme whose art has not landed yet.
 *
 * One boolean is enough here, unlike the stage and the carousel: a row's theme never changes
 * under it, so a failed src cannot come back into view.
 */
function ThemeSwatch({ theme, dimmed }: { theme: StudyRoomTheme; dimmed: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      className={`room-stage relative inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[12px]${dimmed ? " opacity-60" : ""}`}
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
          sizes="44px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

/**
 * A table as a row: its room, its full name (it wraps; a truncated "Sabah Ku…" was the only
 * thing that told two tables apart), where it stands, and who is working there now. A table
 * nobody sat at for a while says so in words rather than fading the whole row out.
 */
function RoomRow({ room }: { room: StudyRoomDto }) {
  const t = useTranslations("session_room");
  const meta = t("row_meta", {
    theme: t(`theme_${room.theme}`),
    filled: room.memberCount,
    capacity: room.capacity,
  });
  return (
    <Link
      href={{ pathname: "/study-session/rooms/[id]", params: { id: room.id } }}
      className="group -mx-1.5 flex items-center gap-3 rounded-[10px] px-1.5 py-2.5 transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
    >
      <ThemeSwatch theme={room.theme} dimmed={!room.isActive} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-sm font-extrabold leading-snug text-[var(--color-main)] [overflow-wrap:anywhere]">
          {room.name}
        </span>
        <span className="text-caption font-semibold text-[var(--color-secondary)]">
          {room.isActive ? meta : `${meta} · ${t("dormant_short")}`}
        </span>
        {room.activeCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-caption font-extrabold text-[var(--color-main)]">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full bg-[var(--color-success)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-success)_24%,transparent)]"
            />
            {t("active_now", { count: room.activeCount })}
          </span>
        ) : null}
      </span>
      <ChevronRight
        aria-hidden
        className="size-[18px] shrink-0 text-[var(--color-secondary)]"
        strokeWidth={1.75}
      />
    </Link>
  );
}

function SessionRoomListSkeleton() {
  const t = useTranslations("session");
  return (
    <SkeletonGroup label={t("loading")} className={`${SESSION_CARD_CLASS} gap-2`}>
      <Skeleton className="h-5 w-28 rounded-[var(--radius-card)]" />
      {[0, 1].map((row) => (
        <div key={row} className="flex items-center gap-3 py-2.5">
          <Skeleton className="size-11 rounded-[12px]" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-32 rounded-[var(--radius-card)]" />
            <Skeleton className="h-3 w-24 rounded-[var(--radius-card)]" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}

/**
 * Join by code. A failure is said under the field, where the code is, instead of in a toast
 * that leaves nothing to fix once it fades; the field keeps focus so a retype is one step.
 */
function JoinSheet({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  /** Resolves when joined; a rejection is explained in place. */
  onJoin: (code: string) => Promise<void>;
}) {
  const t = useTranslations("session_room");
  const fieldRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = code.trim().toUpperCase();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onJoin(value);
    } catch (err) {
      setError(t(`join_failed_${studyRoomJoinFailure(err)}`));
      fieldRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoomSheet
      open
      onClose={onClose}
      title={t("join_action")}
      initialFocusRef={fieldRef}
      closeDisabled={busy}
      onSubmit={(e) => void submit(e)}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${PANEL_QUIET_LINK} max-lg:hidden`}>
            {t("cancel")}
          </button>
          <Button type="submit" busy={busy} disabled={!code.trim()} className="max-lg:w-full">
            {t("join_submit")}
          </Button>
        </>
      }
    >
      <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("join_hint")}</p>
      <TextField
        ref={fieldRef}
        label={t("join_label")}
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
        }}
        placeholder={t("join_placeholder")}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        error={error}
        className="[&_input]:font-mono [&_input]:uppercase [&_input]:tracking-[0.12em]"
      />
    </RoomSheet>
  );
}
