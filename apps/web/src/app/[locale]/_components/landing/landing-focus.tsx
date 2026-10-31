import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { STUDY_ROOM_BACKDROP_SRC, STUDY_ROOM_TABLE_SRC, STUDY_ROOM_THEME_IDS } from "@/lib/study-room-theme";
import { FocusRoom, type FocusRoomTheme } from "./focus-room";
import { landingAvailability } from "./landing-availability";
import { PAGE_FRAME, PAPER_PILL, PAPER_TITLE } from "./landing-paper";
import "./landing-focus.css";

/**
 * "Odak odası": the session page itself, in its own rooms (`study-room-theme.ts`), with its own
 * words (`session.*`, `session_room.*`, `session_ambient.*`, `session_controls.*`). Three notes:
 * Pomodoro, the shared table and the room's sound. The table note and the table sentence of the
 * lead only show while study rooms are on (`studyRooms`); an unknown availability reads as off.
 */

interface FocusNote {
  name: string;
  title: string;
  body: string;
  paper?: "lined" | "grid";
  tilt: string;
  tape: string;
  mini: ReactNode;
}

const SEATS = [
  { place: "top", initial: "E" },
  { place: "left", initial: "S" },
  { place: "right" },
  { place: "bottom" },
] as const;

export async function LandingFocus() {
  const [t, f, availability] = await Promise.all([getTranslations(), getTranslations("landing.focus"), landingAvailability()]);
  const rooms = availability?.studyRooms === true;

  const themes: FocusRoomTheme[] = STUDY_ROOM_THEME_IDS.map((id) => ({
    id,
    label: t(`session_room.theme_${id}`),
    backdrop: STUDY_ROOM_BACKDROP_SRC[id],
    light: id === "HOME",
  }));
  const presets: [string, string, string] = [t("session.stopwatch"), f("preset", { focus: 25, rest: 5 }), f("preset", { focus: 50, rest: 10 })];
  const minutes = (count: number) => f("minutes", { count });

  const notes: FocusNote[] = [
    {
      name: f("pomodoro.name"),
      title: t("session.subtitle"),
      body: f("pomodoro.body"),
      paper: "lined",
      tilt: "-0.7deg",
      tape: "#9cc7f0",
      mini: (
        <>
          <span className="lf-chips is-even">
            {presets.map((preset, i) => (
              <span key={preset} className={i === 2 ? "is-on" : undefined}>
                {preset}
              </span>
            ))}
          </span>
          <span className="lf-timeline">
            <span className="is-focus">
              {t("session.summary_focus")} · {minutes(50)}
            </span>
            <span className="is-break">
              {t("session.summary_break")} · {minutes(10)}
            </span>
          </span>
          <small className="lf-mini-line">
            {t("session.today_title")} 60 {t("session.today_of_goal", { goal: 120 })}
          </small>
        </>
      ),
    },
    ...(rooms
      ? [
          {
            name: f("table.name"),
            title: f("table.title"),
            body: f("table.body"),
            tilt: "0.5deg",
            tape: "#f7b3a0",
            mini: (
              <>
                <span className="lf-table">
                  {STUDY_ROOM_THEME_IDS.map((id) => (
                    <Image key={id} src={STUDY_ROOM_TABLE_SRC[id]} alt="" width={320} height={320} sizes="190px" className="lf-table-art" data-room={id} />
                  ))}
                  {SEATS.map((seat) => {
                    const sitting = "initial" in seat;
                    const label =
                      seat.place === "top"
                        ? `${f("table.friend")} · ${t("session_room.seat_focusing_short", { minutes: 18 })}`
                        : seat.place === "left"
                          ? `${f("table.me")} · ${t("session_room.seat_focusing_short", { minutes: 7 })}`
                          : t("session_room.invite_seat");
                    return (
                      <span key={seat.place} className={`lf-seat is-${seat.place}${sitting ? "" : " is-empty"}`}>
                        <b>{sitting ? seat.initial : "+"}</b>
                        <small>{label}</small>
                      </span>
                    );
                  })}
                </span>
                <span className="lf-code">
                  <span>MASA-K7P2QX</span>
                  <em>{t("session_room.invite_share")}</em>
                </span>
              </>
            ),
          } satisfies FocusNote,
        ]
      : []),
    {
      name: t("session_ambient.picker_label"),
      title: f("sound.title"),
      body: f("sound.body"),
      paper: "grid",
      tilt: "-0.4deg",
      tape: "#a8d8b0",
      mini: (
        <>
          <span className="lf-chips">
            {(["track_scene", "track_library", "track_cafe", "track_home", "track_off"] as const).map((key, i) => (
              <span key={key} className={i === 0 ? "is-on" : undefined}>
                {i === 0 ? "♪ " : ""}
                {t(`session_ambient.${key}`)}
              </span>
            ))}
          </span>
          <span className="lf-plain">
            <span>{t("session_room.plain_view_on")}</span>
            <i />
          </span>
        </>
      ),
    },
  ];

  return (
    <section id="odak" aria-labelledby="landing-focus-title" className={`lf-root ${PAGE_FRAME} scroll-mt-24 pt-16 lg:pt-24`}>
      <div className="max-w-3xl">
        <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>{f("pill")}</p>
        <h2 id="landing-focus-title" className={PAPER_TITLE}>
          {f("title")}
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-[var(--landing-ink-soft)]">{rooms ? f("lead_rooms") : f("lead")}</p>
      </div>
      <FocusRoom
        themes={themes}
        tabsLabel={t("session_room.theme_label")}
        scene={{
          subject: f("subject"),
          ambient: t("session_ambient.track_scene"),
          task: t("session.history_plan_task", { title: f("task") }),
          minutes: 50,
          unit: f("unit"),
          presets,
          summary: t.rich("session.summary_line", { focus: 50, breakMin: 10, finish: "14:20", b: (chunks) => <b>{chunks}</b> }),
          start: t("session_controls.start"),
        }}
      >
        <div className="lf-notes" style={{ "--lf-notes": notes.length } as CSSProperties}>
          {notes.map((note, i) => (
            <article
              key={note.name}
              className={`lf-note${note.paper ? ` is-${note.paper}` : ""}`}
              style={{ "--tilt": note.tilt, "--tape": note.tape } as CSSProperties}
              data-flutter=""
            >
              <i className="lf-tape" aria-hidden="true" />
              <p className="lf-plate">
                <b>{i + 1}</b>
                <span>{note.name}</span>
              </p>
              <h3>{note.title}</h3>
              <p className="lf-body">{note.body}</p>
              <div className="lf-mini" aria-hidden="true">
                {note.mini}
              </div>
            </article>
          ))}
        </div>
      </FocusRoom>
    </section>
  );
}
