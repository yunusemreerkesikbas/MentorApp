"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CoachPlanItemDto,
  MentorshipRosterRowDto,
  PublicHolidayDto,
} from "@mentor/types";
import { Button, Card } from "@mentor/ui";
import { useTranslations } from "next-intl";
import {
  COACH_PLAN_SCALE_STORAGE_KEY,
  coachPlanRange,
  consumeInitialCoachPlanEvent,
  reconcileCoachPlanSelection,
  restoreCoachPlanTrigger,
  sortCoachPlanItems,
  type CoachPlanScale,
} from "@/lib/coach-plan-calendar";
import {
  coachPlanCalendarItems,
  coachPlanMarkedDates,
} from "@/lib/coach-plan-calendar-item";
import { todayInIstanbul } from "@/lib/date-time";
import { fetchCoachPlan } from "@/lib/mentorship";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorToast } from "@/lib/mentor-toast";
import { listPublicHolidaysByDate } from "@/lib/plan-tasks";
import { PlanCalendarFab } from "./plan-calendar-fab";
import { PlanCalendarFrame } from "./plan-calendar-frame";
import { PlanCalendarHeader } from "./plan-calendar-header";
import { PlanEventPreview, usePlanEventPreview } from "./plan-event-preview";
import { PlanMobileAgenda } from "./plan-mobile-agenda";
import { PlanMobileDateStrip } from "./plan-mobile-date-strip";
import { PlanMonthGrid } from "./plan-month-grid";
import { PlanTimeGrid } from "./plan-time-grid";
import {
  persistCalendarScale,
  readStoredCalendarScale,
  shiftDate,
  shiftMonth,
  weekDates,
  weekStart,
} from "./plan-utils";
import { CoachPlanDetail } from "./coach-plan-detail";
import {
  CoachPlanOpenFormPanel,
  type CoachPlanOpenForm,
} from "./coach-plan-open-form";
import { CoachPlanRail } from "./coach-plan-rail";
import { CoachPlanSkeleton } from "./coach-plan-skeleton";
import { CoachPlanStudentFilter } from "./coach-plan-student-filter";
import { CoachPlanToolbar } from "./coach-plan-toolbar";

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
  const t = useTranslations("coachPlan");
  const toast = useMentorToast();
  const { actionSheet } = useMentorBottomSheet();
  const { preview, onHover } = usePlanEventPreview<CoachPlanItemDto>();
  const [scale, setScale] = useState<CoachPlanScale>("week");
  const [anchor, setAnchor] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [items, setItems] = useState<CoachPlanItemDto[]>([]);
  const [selectedItem, setSelectedItem] = useState<CoachPlanItemDto | null>(null);
  const [holidays, setHolidays] = useState<Record<string, PublicHolidayDto>>({});
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openForm, setOpenForm] = useState<CoachPlanOpenForm | null>(null);
  const initialEventStateRef = useRef({ pendingEventId: initialEventId });
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const formTriggerRef = useRef<HTMLButtonElement | null>(null);
  const weekStartDate = weekStart(selectedDate);
  const range = useMemo(
    () => coachPlanRange(selectedDate, "month"),
    [selectedDate],
  );
  const requestKey = `${range.from}:${range.to}:${studentId ?? "all"}:${reloadKey}`;
  const planLoading = loadedKey !== requestKey && errorKey !== requestKey;
  const planError = errorKey === requestKey;
  const itemLabels = useMemo(
    () => ({
      personal: t("personal"),
      cancelled: t("event_cancelled"),
      hint: t("calendar_preview_hint"),
    }),
    [t],
  );
  const itemsByDate = useMemo(
    () => coachPlanCalendarItems(items, range.days, itemLabels),
    [itemLabels, items, range.days],
  );

  useEffect(() => {
    // Reads localStorage after mount so the stored scale can't cause an SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScale(readStoredCalendarScale(COACH_PLAN_SCALE_STORAGE_KEY));
  }, []);

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
        } else {
          setSelectedItem((current) => {
            const fresh = reconcileCoachPlanSelection(current, orderedItems);
            if (!fresh) detailTriggerRef.current = null;
            return fresh;
          });
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

  useEffect(() => {
    let active = true;
    void listPublicHolidaysByDate(range.from, range.to)
      .then((data) => {
        if (active) setHolidays(data);
      })
      .catch(() => {
        if (active) setHolidays({});
      });
    return () => {
      active = false;
    };
  }, [range.from, range.to]);

  const loadMarkedDates = useCallback(
    async (from: string, to: string) => {
      const plan = await fetchCoachPlan({
        from,
        to,
        ...(studentId ? { studentId } : {}),
      });
      return coachPlanMarkedDates(plan);
    },
    [studentId],
  );

  const selectDate = useCallback((date: string, clearSelection = true) => {
    setSelectedDate(date);
    setAnchor(date);
    if (clearSelection) setSelectedItem(null);
  }, []);

  const selectItem = useCallback((item: CoachPlanItemDto, trigger: HTMLButtonElement) => {
    detailTriggerRef.current = trigger;
    setSelectedItem(item);
    setSelectedDate(item.kind === "TASK" ? item.task.taskDate : item.event.eventDate);
  }, []);

  const chooseScale = useCallback((next: CoachPlanScale) => {
    setScale(next);
    persistCalendarScale(next, COACH_PLAN_SCALE_STORAGE_KEY);
    setAnchor(selectedDate);
  }, [selectedDate]);

  const closeDetail = useCallback(() => {
    const trigger = detailTriggerRef.current;
    detailTriggerRef.current = null;
    setSelectedItem(null);
    requestAnimationFrame(() => restoreCoachPlanTrigger(trigger));
  }, []);

  const closeForm = useCallback(() => {
    const trigger = formTriggerRef.current;
    formTriggerRef.current = null;
    setOpenForm(null);
    requestAnimationFrame(() => restoreCoachPlanTrigger(trigger));
  }, []);

  const mutationSucceeded = useCallback((message: string) => {
    formTriggerRef.current = null;
    setOpenForm(null);
    setSelectedItem(null);
    detailTriggerRef.current = null;
    setReloadKey((value) => value + 1);
    toast.success({ title: message });
  }, [toast]);

  const creationSucceeded = useCallback((message: string) => {
    formTriggerRef.current = null;
    setOpenForm(null);
    setReloadKey((value) => value + 1);
    toast.success({ title: message });
  }, [toast]);

  const openCreateChooser = useCallback(
    async (input: { date: string; startTime?: string; trigger?: HTMLButtonElement }) => {
      if (input.trigger) formTriggerRef.current = input.trigger;
      const choice = await actionSheet({
        title: t("new_item_title"),
        actions: [
          { id: "task", label: t("new_task"), showChevron: false },
          { id: "event", label: t("new_event"), showChevron: false },
        ],
      });
      if (choice === "task") {
        setOpenForm({
          kind: "TASK_CREATE",
          initialDate: input.date,
          initialStartTime: input.startTime,
        });
      } else if (choice === "event") {
        setOpenForm({
          kind: "EVENT_CREATE",
          initialDate: input.date,
          initialStartTime: input.startTime,
        });
      }
    },
    [actionSheet, t],
  );

  if (planLoading || rosterLoading) return <CoachPlanSkeleton />;
  const error = planError || rosterError;
  const dayItems = itemsByDate[selectedDate] ?? [];
  const gridProps = {
    selectedDate,
    itemsByDate,
    holidaysByDate: holidays,
    namespace: "coachPlan" as const,
    onDateChange: (date: string) => selectDate(date, false),
    onOpenItem: selectItem,
    onCreateAt: (iso: string, startTime: string) =>
      void openCreateChooser({ date: iso, startTime }),
    onHover,
  };

  return (
    <main className="flex w-full flex-col gap-3 px-2 py-4 lg:h-dvh lg:px-6 lg:py-4">
      {/* Above the live detail overlay (z-40). The form drawer is z-50 and still covers this. */}
      <div className="relative z-50">
        <CoachPlanToolbar
          onNewTask={(trigger) => {
            formTriggerRef.current = trigger;
            setOpenForm({ kind: "TASK_CREATE", initialDate: selectedDate });
          }}
          onNewEvent={(trigger) => {
            formTriggerRef.current = trigger;
            setOpenForm({ kind: "EVENT_CREATE", initialDate: selectedDate });
          }}
        />
      </div>

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
      ) : (
        <>
          <div className="lg:hidden">
            <CoachPlanStudentFilter
              roster={roster}
              studentId={studentId}
              onStudent={(next) => {
                setStudentId(next);
                setSelectedItem(null);
              }}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <PlanCalendarFrame
              rail={
                <CoachPlanRail
                  selectedDate={selectedDate}
                  weekStartDate={weekStartDate}
                  roster={roster}
                  studentId={studentId}
                  dayItems={dayItems}
                  loadMarkedDates={loadMarkedDates}
                  onDateChange={(date) => selectDate(date)}
                  onStudent={(next) => {
                    setStudentId(next);
                    setSelectedItem(null);
                  }}
                  onOpen={selectItem}
                  onAdd={() => void openCreateChooser({ date: selectedDate })}
                />
              }
            >
              <div className="shrink-0">
                <PlanCalendarHeader
                  scale={scale}
                  selectedDate={selectedDate}
                  weekStartDate={weekStartDate}
                  monthAnchor={`${anchor.slice(0, 7)}-01`}
                  namespace="coachPlan"
                  onScaleChange={chooseScale}
                  onStep={(direction) => {
                    const next =
                      scale === "day"
                        ? shiftDate(selectedDate, direction)
                        : scale === "week"
                          ? shiftDate(weekStartDate, direction * 7)
                          : shiftMonth(selectedDate, direction);
                    selectDate(next);
                  }}
                  onToday={() => selectDate(todayInIstanbul())}
                />
              </div>
              <PlanMobileDateStrip
                weekStartDate={weekStartDate}
                selectedDate={selectedDate}
                itemsByDate={itemsByDate}
                holidaysByDate={holidays}
                highlightGroup={null}
                expanded={scale === "month"}
                namespace="coachPlan"
                onDateChange={(date) => selectDate(date)}
                onOpenItem={selectItem}
                onExpand={() => chooseScale("month")}
                onCollapse={() => chooseScale("day")}
              />
              {scale === "month" ? (
                <div className="hidden lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                  <PlanMonthGrid
                    monthAnchor={`${anchor.slice(0, 7)}-01`}
                    selectedDate={selectedDate}
                    itemsByDate={itemsByDate}
                    holidaysByDate={holidays}
                    highlightGroup={null}
                    namespace="coachPlan"
                    onDateChange={(date) => selectDate(date)}
                    onOpenItem={selectItem}
                    onCreateAt={(iso) => void openCreateChooser({ date: iso })}
                    onHover={onHover}
                  />
                </div>
              ) : scale === "day" ? (
                <PlanTimeGrid {...gridProps} days={[selectedDate]} />
              ) : (
                <>
                  <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                    <PlanTimeGrid {...gridProps} days={weekDates(weekStartDate)} />
                  </div>
                  <PlanMobileAgenda
                    days={range.days}
                    selectedDate={selectedDate}
                    itemsByDate={itemsByDate}
                    holidaysByDate={holidays}
                    namespace="coachPlan"
                    onDateChange={(date) => selectDate(date, false)}
                    onOpenItem={selectItem}
                  />
                </>
              )}
            </PlanCalendarFrame>
          </div>
          <PlanCalendarFab
            label={t("calendar_add_on", { date: selectedDate })}
            onClick={() => void openCreateChooser({ date: selectedDate })}
          />
          <PlanEventPreview preview={preview} namespace="coachPlan" />
        </>
      )}

      {!error && selectedItem ? (
        <CoachPlanDetail
          item={selectedItem}
          onClose={closeDetail}
          onEdit={(trigger, target) => {
            formTriggerRef.current = trigger;
            if (selectedItem.kind === "TASK" && target) {
              setOpenForm({ kind: "TASK_EDIT", task: selectedItem.task, target });
            } else if (selectedItem.kind === "EVENT") {
              setOpenForm({ kind: "EVENT_EDIT", event: selectedItem.event });
            }
          }}
          onMutationSuccess={mutationSucceeded}
        />
      ) : null}
      {openForm ? (
        <CoachPlanOpenFormPanel
          form={openForm}
          roster={roster}
          onClose={closeForm}
          onCreationSuccess={creationSucceeded}
          onMutationSuccess={mutationSucceeded}
        />
      ) : null}
    </main>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
