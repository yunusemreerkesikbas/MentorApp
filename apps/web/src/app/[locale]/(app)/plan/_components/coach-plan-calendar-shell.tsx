"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CoachPlanItemDto, MentorshipRosterRowDto } from "@mentor/types";
import { Button, Card } from "@mentor/ui";
import { useLocale, useTranslations } from "next-intl";
import {
  coachPlanRange,
  consumeInitialCoachPlanEvent,
  restoreCoachPlanTrigger,
  sortCoachPlanItems,
  type CoachPlanScale,
} from "@/lib/coach-plan-calendar";
import { todayInIstanbul } from "@/lib/date-time";
import { fetchCoachPlan } from "@/lib/mentorship";
import { CoachPlanDetail } from "./coach-plan-detail";
import { coachPlanItemId } from "./coach-plan-item-card";
import { CoachPlanMonth } from "./coach-plan-month";
import { CoachPlanSkeleton } from "./coach-plan-skeleton";
import { CoachPlanToolbar } from "./coach-plan-toolbar";
import { CoachPlanWeek } from "./coach-plan-week";

interface CoachPlanCalendarShellProps {
  initialDate: string;
  initialEventId: string | null;
  roster: MentorshipRosterRowDto[];
  rosterLoading: boolean;
  rosterError: boolean;
  onRetryRoster: () => void;
}

export function CoachPlanCalendarShell({
  initialDate,
  initialEventId,
  roster,
  rosterLoading,
  rosterError,
  onRetryRoster,
}: CoachPlanCalendarShellProps) {
  const locale = useLocale();
  const t = useTranslations("coachPlan");
  const [scale, setScale] = useState<CoachPlanScale>("week");
  const [anchor, setAnchor] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [items, setItems] = useState<CoachPlanItemDto[]>([]);
  const [selectedItem, setSelectedItem] = useState<CoachPlanItemDto | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const initialEventStateRef = useRef({ pendingEventId: initialEventId });
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const range = useMemo(() => coachPlanRange(anchor, scale), [anchor, scale]);
  const requestKey = `${range.from}:${range.to}:${studentId ?? "all"}:${reloadKey}`;
  const planLoading = loadedKey !== requestKey && errorKey !== requestKey;
  const planError = errorKey === requestKey;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetchCoachPlan({
      from: range.from,
      to: range.to,
      ...(studentId ? { studentId } : {}),
      signal: controller.signal,
    })
      .then((planItems) => {
        if (!active) return;
        const orderedItems = sortCoachPlanItems(planItems);
        setErrorKey(null);
        setLoadedKey(requestKey);
        setItems(orderedItems);
        const initialSelection = consumeInitialCoachPlanEvent(
          initialEventStateRef.current,
          orderedItems,
        );
        initialEventStateRef.current = {
          pendingEventId: initialSelection.pendingEventId,
        };
        if (initialSelection.applied) {
          detailTriggerRef.current = null;
          setSelectedItem(initialSelection.item);
          if (initialSelection.item?.kind === "EVENT") {
            setSelectedDate(initialSelection.item.event.eventDate);
          }
        }
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setErrorKey(requestKey);
        setLoadedKey(requestKey);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [range.from, range.to, requestKey, studentId]);

  const selectItem = useCallback((item: CoachPlanItemDto, trigger: HTMLButtonElement) => {
    detailTriggerRef.current = trigger;
    setSelectedItem(item);
    setSelectedDate(item.kind === "TASK" ? item.task.taskDate : item.event.eventDate);
  }, []);

  const navigate = useCallback((direction: -1 | 1) => {
    const next = scale === "week"
      ? shiftDays(anchor, direction * 7)
      : shiftMonths(anchor, direction);
    setAnchor(next);
    setSelectedDate(next);
    setSelectedItem(null);
  }, [anchor, scale]);

  const chooseScale = useCallback((next: CoachPlanScale) => {
    setScale(next);
    setAnchor(selectedDate);
    setSelectedItem(null);
  }, [selectedDate]);

  const closeDetail = useCallback(() => {
    if (!selectedItem) return;
    const trigger = detailTriggerRef.current;
    detailTriggerRef.current = null;
    setSelectedItem(null);
    requestAnimationFrame(() => restoreCoachPlanTrigger(trigger));
  }, [selectedItem]);

  if (planLoading || rosterLoading) return <CoachPlanSkeleton />;
  const error = planError || rosterError;
  const selectedId = selectedItem ? coachPlanItemId(selectedItem) : null;
  const dateLabel = scale === "week"
    ? formatWeekLabel(range.from, range.to, locale)
    : new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })
        .format(new Date(`${anchor.slice(0, 7)}-01T12:00:00Z`));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6 sm:px-8 lg:py-10">
      <CoachPlanToolbar
        scale={scale}
        dateLabel={dateLabel}
        roster={roster}
        studentId={studentId}
        onScale={chooseScale}
        onStudent={(next) => {
          setStudentId(next);
          setSelectedItem(null);
        }}
        onPrevious={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={() => {
          const today = todayInIstanbul();
          setAnchor(today);
          setSelectedDate(today);
          setSelectedItem(null);
        }}
      />

      {error ? (
        <Card className="flex flex-col items-start gap-3">
          <h2 className="font-semibold" style={{ color: "var(--color-main)" }}>
            {t("error_title")}
          </h2>
          <p style={{ color: "var(--color-secondary)" }}>{t("error_body")}</p>
          <Button
            variant="secondary"
            onClick={() => {
              if (rosterError) onRetryRoster();
              if (planError) setReloadKey((value) => value + 1);
            }}
          >
            {t("retry")}
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <h2 className="font-semibold" style={{ color: "var(--color-main)" }}>
            {t("empty_title")}
          </h2>
          <p className="mt-1" style={{ color: "var(--color-secondary)" }}>
            {t(studentId ? "empty_filtered" : "empty_body")}
          </p>
        </Card>
      ) : scale === "week" ? (
        <CoachPlanWeek
          days={range.days}
          items={items}
          selectedId={selectedId}
          onSelect={selectItem}
        />
      ) : (
        <CoachPlanMonth
          days={range.days}
          month={anchor.slice(0, 7)}
          items={items}
          selectedDate={selectedDate}
          selectedId={selectedId}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setSelectedItem(null);
          }}
          onSelectItem={selectItem}
        />
      )}

      {!error && selectedItem && (
        <CoachPlanDetail item={selectedItem} onClose={closeDetail} />
      )}
    </main>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function shiftDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function shiftMonths(value: string, amount: number): string {
  const date = new Date(`${value.slice(0, 7)}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10);
}

function formatWeekLabel(from: string, to: string, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(new Date(`${from}T12:00:00Z`))} – ${formatter.format(
    new Date(`${to}T12:00:00Z`),
  )}`;
}
