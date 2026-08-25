"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Users } from "lucide-react";
import type { StudyRoomDto, StudyRoomTheme } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import {
  STUDY_ROOM_CAPACITY_DEFAULT,
  STUDY_ROOM_CAPACITY_MAX,
  STUDY_ROOM_CAPACITY_MIN,
  STUDY_ROOM_THEME_IDS,
} from "@/lib/study-room-theme";
import { createStudyRoom, joinStudyRoom, listStudyRooms } from "@/lib/study-rooms";
import { useMentorToast } from "@/lib/mentor-toast";

type State =
  | { status: "loading" }
  // Feature flag off (403) or API error → the section disappears rather than showing a broken box.
  | { status: "hidden" }
  | { status: "ready"; rooms: StudyRoomDto[] };

/**
 * "Masalarım" on the /study-session idle screen: the rooms a user belongs to, plus the two
 * ways in — create one, or paste an invite code. Counts are `memberCount/capacity` (seats
 * held) and `activeCount` (people actually studying right now); those are different numbers.
 */
export function SessionRoomList() {
  const t = useTranslations("session_room");
  const { error: showErrorToast, success: showSuccessToast } = useMentorToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"none" | "create" | "join">("none");

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

  const run = async (action: () => Promise<unknown>, successMessage?: string) => {
    setBusy(true);
    try {
      await action();
      if (successMessage) {
        showSuccessToast({ title: successMessage, duration: 2500 });
      }
      setMode("none");
      load();
      return true;
    } catch (err) {
      showErrorToast({
        title: t("error_title"),
        message: err instanceof ApiClientError ? err.body.message : undefined,
        duration: 3000,
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (state.status === "loading" || state.status === "hidden") return null;

  return (
    <Card className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("section_title")}
        </span>
        {state.rooms.length > 0 ? (
          <button
            type="button"
            onClick={() => setMode(mode === "create" ? "none" : "create")}
            aria-label={t("create_action")}
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-progress) 14%, transparent)",
              color: "var(--color-main)",
            }}
          >
            <Plus className="size-4" strokeWidth={2.5} aria-hidden />
          </button>
        ) : null}
      </div>

      {state.rooms.length === 0 ? (
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-secondary)" }}>
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {state.rooms.map((room) => (
            <li key={room.id}>
              <Link
                href={{ pathname: "/study-session/rooms/[id]", params: { id: room.id } }}
                className="flex items-center gap-3 rounded-[var(--radius-card)] px-2 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)] motion-reduce:transition-none"
                style={{ opacity: room.isActive ? 1 : 0.6 }}
              >
                <span
                  aria-hidden
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--color-progress) 12%, transparent)",
                  }}
                >
                  <Users className="size-4" strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span
                    className="block truncate text-sm font-bold"
                    style={{
                      color: "var(--color-main)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {room.name}
                  </span>
                  <span className="block truncate text-xs" style={{ color: "var(--color-secondary)" }}>
                    {t("theme_" + room.theme)} ·{" "}
                    {t("seats", { filled: room.memberCount, capacity: room.capacity })}
                  </span>
                </span>
                {room.activeCount > 0 ? (
                  <span
                    className="flex shrink-0 items-center gap-1.5 text-xs font-semibold"
                    style={{ color: "var(--color-success)" }}
                  >
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full animate-pulse motion-reduce:animate-none"
                      style={{ backgroundColor: "var(--color-success)" }}
                    />
                    {room.activeCount}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {mode === "create" ? (
        <CreateRoomForm
          busy={busy}
          onCancel={() => setMode("none")}
          onSubmit={(input) => run(() => createStudyRoom(input))}
        />
      ) : mode === "join" ? (
        <JoinRoomForm
          busy={busy}
          onCancel={() => setMode("none")}
          onSubmit={(code) => run(() => joinStudyRoom(code))}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {state.rooms.length === 0 ? (
            <TextAction label={t("create_action")} tone="accent" onClick={() => setMode("create")} />
          ) : null}
          <TextAction label={t("join_action")} onClick={() => setMode("join")} />
        </div>
      )}
    </Card>
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

const fieldClass =
  "min-w-0 flex-1 rounded-[var(--radius-card)] border bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2";
const fieldStyle = {
  borderColor: "var(--color-progress-track)",
  color: "var(--color-main)",
} as const;

function CreateRoomForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: { name: string; theme: StudyRoomTheme; capacity: number }) => Promise<boolean>;
}) {
  const t = useTranslations("session_room");
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<StudyRoomTheme>("LIBRARY");
  const [capacity, setCapacity] = useState(STUDY_ROOM_CAPACITY_DEFAULT);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        void onSubmit({ name: name.trim(), theme, capacity });
      }}
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
          {t("name_label")}
        </span>
        <input
          type="text"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("name_placeholder")}
          className={fieldClass}
          style={fieldStyle}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
          {t("theme_label")}
        </span>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as StudyRoomTheme)}
          className={fieldClass}
          style={fieldStyle}
        >
          {STUDY_ROOM_THEME_IDS.map((id) => (
            <option key={id} value={id}>
              {t("theme_" + id)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
          {t("capacity_label")}
        </span>
        <input
          type="number"
          value={capacity}
          min={STUDY_ROOM_CAPACITY_MIN}
          max={STUDY_ROOM_CAPACITY_MAX}
          onChange={(e) => setCapacity(Number.parseInt(e.target.value, 10) || STUDY_ROOM_CAPACITY_MIN)}
          className={fieldClass}
          style={fieldStyle}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="min-h-11 flex-1 cursor-pointer rounded-[var(--radius-card)] text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--color-progress)", color: "var(--color-bg)" }}
        >
          {t("create_submit")}
        </button>
        <TextAction label={t("cancel")} onClick={onCancel} />
      </div>
    </form>
  );
}

function JoinRoomForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (code: string) => Promise<boolean>;
}) {
  const t = useTranslations("session_room");
  const [code, setCode] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!code.trim() || busy) return;
        void onSubmit(code.trim().toUpperCase());
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("join_placeholder")}
          aria-label={t("join_action")}
          autoComplete="off"
          autoCapitalize="characters"
          className={fieldClass}
          style={fieldStyle}
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--color-progress)", color: "var(--color-bg)" }}
        >
          {t("join_submit")}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <TextAction label={t("cancel")} onClick={onCancel} />
      </div>
    </form>
  );
}
