import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isPastDate } from "@mentor/core";
import type { PlanTaskDto } from "@mentor/types";
import { deletePlanTask, updatePlanTask } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { withTaskStatus } from "../../lib/plan-view.js";

/**
 * Tick and delete for the Plan tab's rows, shared by Liste and Timeline: one task at a time,
 * the tick shown before the server answers and rolled back if it fails.
 */
export function usePlanTaskActions({
  weekKey,
  onChanged,
  onError,
}: {
  weekKey: readonly unknown[];
  onChanged: () => Promise<void> | void;
  onError: (error: unknown) => void;
}) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  // State re-renders the rows; the ref closes the gap before that render, so a second tap in the
  // same frame cannot send a second PATCH.
  const busyRef = useRef<string | null>(null);

  const begin = (id: string) => {
    busyRef.current = id;
    setBusyId(id);
  };
  const end = () => {
    busyRef.current = null;
    setBusyId(null);
  };

  const toggle = async (task: PlanTaskDto) => {
    if (busyRef.current || isPastDate(task.taskDate)) return;
    begin(task.id);
    const nextStatus = task.status === "DONE" ? "PENDING" : "DONE";
    // A refetch already in flight (focus, pull) would land the old status over the tick.
    await queryClient.cancelQueries({ queryKey: weekKey });
    const previous = queryClient.getQueryData<Record<string, PlanTaskDto[]>>(weekKey);
    if (previous) queryClient.setQueryData(weekKey, withTaskStatus(previous, task.id, nextStatus));
    try {
      await updatePlanTask(task.id, { status: nextStatus });
    } catch (error) {
      if (previous) queryClient.setQueryData(weekKey, previous);
      onError(error);
      return;
    } finally {
      // Free the rows once the write lands: the refetches below need no lock, and a delete
      // confirmed meanwhile must not be dropped.
      end();
    }
    if (nextStatus === "DONE") haptics.lightImpact();
    void onChanged();
  };

  const remove = async (task: PlanTaskDto) => {
    if (busyRef.current || isPastDate(task.taskDate)) return;
    begin(task.id);
    try {
      await deletePlanTask(task.id);
    } catch (error) {
      onError(error);
      return;
    } finally {
      end();
    }
    void onChanged();
  };

  return { busyId, toggle, remove };
}
