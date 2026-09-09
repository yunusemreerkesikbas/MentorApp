"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CoachPlanItemDto, MentorshipRosterRowDto } from "@mentor/types";
import { Button, Card } from "@mentor/ui";
import { useLocale, useTranslations } from "next-intl";
import {
  coachPlanRange,
  parseCoachPlanSelection,
  sortCoachPlanItems,
  type CoachPlanScale,
} from "@/lib/coach-plan-calendar";
import { fetchActiveRoster, fetchCoachPlan } from "@/lib/mentorship";
import { CoachPlanDetail } from "./coach-plan-detail";
import { coachPlanItemId } from "./coach-plan-item-card";
import { CoachPlanMonth } from "./coach-plan-month";
import { CoachPlanSkeleton } from "./coach-plan-skeleton";
import { CoachPlanToolbar } from "./coach-plan-toolbar";
import { CoachPlanWeek } from "./coach-plan-week";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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

export function CoachPlanShell() {
  const locale = useLocale();
  const t = useTranslations("coachPlan");
  const searchParams = useSearchParams();
  const initialQuery = useMemo(
    () => parseCoachPlanSelection(
      { date: searchParams.get("date"), event: searchParams.get("event") },
      { from: "0000-01-01", to: "9999-12-31" },
    ),
    [searchParams],
  );
  const [scale, setScale] = useState<CoachPlanScale>("week");
  const [anchor, setAnchor] = useState(() => initialQuery.date ?? todayIso());
  const [selectedDate, setSelectedDate] = useState(() => initialQuery.date ?? todayIso());
  const [studentId, setStudentId] = useState<string | null>(null);
  const [roster, setRoster] = useState<MentorshipRosterRowDto[]>([]);
  const [items, setItems] = useState<CoachPlanItemDto[]>([]);
  const [selectedItem, setSelectedItem] = useState<CoachPlanItemDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const range = useMemo(() => coachPlanRange(anchor, scale), [anchor, scale]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void Promise.all([
      fetchActiveRoster(),
      fetchCoachPlan({
        from: range.from,
        to: range.to,
        ...(studentId ? { studentId } : {}),
      }),
    ])
      .then(([rosterItems, planItems]) => {
        if (!active) return;
        const orderedItems = sortCoachPlanItems(planItems);
        setRoster(rosterItems);
        setItems(orderedItems);
        const deepLinked = initialQuery.eventId
          ? orderedItems.find(
              (item) => item.kind === "EVENT" && item.event.id === initialQuery.eventId,
            )
          : undefined;
        if (deepLinked?.kind === "EVENT") {
          setSelectedDate(deepLinked.event.eventDate);
          setSelectedItem(deepLinked);
        } else {
          setSelectedItem(null);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialQuery.eventId, range.from, range.to, reloadKey, studentId]);

  const selectItem = useCallback((item: CoachPlanItemDto) => {
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

  if (loading) return <CoachPlanSkeleton />;

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
          const today = todayIso();
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
          <Button variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
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
          selectedId={selectedItem ? coachPlanItemId(selectedItem) : null}
          onSelect={selectItem}
        />
      ) : (
        <CoachPlanMonth
          days={range.days}
          month={anchor.slice(0, 7)}
          items={items}
          selectedDate={selectedDate}
          selectedId={selectedItem ? coachPlanItemId(selectedItem) : null}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setSelectedItem(null);
          }}
          onSelectItem={selectItem}
        />
      )}

      {selectedItem && (
        <CoachPlanDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </main>
  );
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
