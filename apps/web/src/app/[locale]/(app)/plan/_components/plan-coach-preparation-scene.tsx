"use client";

import { useId, useLayoutEffect, useRef, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import Image from "next/image";
import type { PlanPreparationState, PlanCoachInput } from "./use-plan-coach-preparation";
import { PlanCoachPreparationMedia } from "./plan-coach-preparation-media";
import styles from "./plan-coach-preparation-scene.module.css";

const ART = "/mascot/puhu/planning-flight";

export function PlanCoachPreparationScene({
  state,
  slow,
  onClose,
  onRetry,
  onEdit,
  returnFocusRef,
}: {
  state: Exclude<PlanPreparationState, { status: "idle" | "ready" }>;
  slow: boolean;
  onClose: () => void;
  onRetry: (input: PlanCoachInput) => void;
  onEdit: (input: PlanCoachInput) => void;
  returnFocusRef: RefObject<HTMLSpanElement | null>;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const node = dialogRef.current!;
    const returnButton = returnFocusRef.current?.querySelector("button");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    return () => {
      node.close();
      document.body.style.overflow = previousOverflow;
      // A completed request opens the preview in the same commit; do not steal its focus.
      if (!document.querySelector("dialog[open]"))
        returnButton?.focus();
    };
  }, [returnFocusRef]);

  const weekdays = state.input.studyWeekdays ?? [];
  const subjects = state.input.focusSubjects ?? [];
  const dayName = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={styles.scene}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <PlanCoachPreparationMedia />
      <div className={styles.shade} aria-hidden />
      <div className={styles.content}>
        <header className={styles.heading}>
          <p className={styles.kicker}>{t("coach_flight_kicker")}</p>
          <h1 id={titleId}>{t("coach_flight_title")}</h1>
          <p>{t("coach_flight_subtitle")}</p>
        </header>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label={t("coach_flight_close")}
        >
          <X size={24} aria-hidden />
        </button>
        <div className={styles.journey} aria-hidden>
          {subjects.slice(0, 4).map((subject, index) => (
            <Image unoptimized
              key={subject}
              src={`${ART}/paper-bird.webp`}
              alt=""
              width={96}
              height={96}
              className={styles.bird}
              style={{ animationDelay: `${index * -2}s` }}
            />
          ))}
        </div>
        <footer className={styles.footer}>
          <ul className={styles.days} aria-label={t("coach_flight_days")}>
            {weekdays.map((day) => (
              <li key={day}>
                <Image unoptimized
                  src={`${ART}/day-island.webp`}
                  alt=""
                  width={72}
                  height={72}
                  aria-hidden
                />
                <span>{dayName.format(new Date(Date.UTC(2024, 0, day)))}</span>
              </li>
            ))}
          </ul>
          <div className={styles.summary}>
            {state.input.minutesPerDay != null ? (
              <strong>
                {t("coach_flight_minutes", {
                  count: state.input.minutesPerDay,
                })}
              </strong>
            ) : null}
            <span>
              {subjects.slice(0, 4).join(" · ")}
              {subjects.length > 4
                ? ` · ${t("coach_flight_more_subjects", { count: subjects.length - 4 })}`
                : ""}
            </span>
            {!weekdays.length &&
            !subjects.length &&
            state.input.minutesPerDay == null ? (
              <span>{t("coach_flight_defaults")}</span>
            ) : null}
          </div>
          {state.status === "error" ? (
            <div className={styles.error}>
              <p role="alert">{state.message}</p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => onRetry(state.input)}
                >
                  {t("coach_flight_retry")}
                </button>
                <button type="button" onClick={() => onEdit(state.input)}>
                  {t("coach_flight_edit")}
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.status} role="status">
              {slow ? t("coach_flight_slow") : t("coach_flight_wait")}
            </p>
          )}
        </footer>
      </div>
    </dialog>
  );
}
