"use client";

import { UserRole } from "@mentor/types";
import { useAuth } from "@/lib/auth-context";
import { CoachPlanShell } from "./coach-plan-shell";
import { CoachPlanSkeleton } from "./coach-plan-skeleton";
import { PlanShell } from "./plan-shell";

/** Role selection is presentation only; every coach endpoint enforces W8 authorization. */
export function RoleAwarePlanShell() {
  const { status, user } = useAuth();

  if (status === "loading") return <CoachPlanSkeleton />;
  if (user?.roles.includes(UserRole.COACH)) return <CoachPlanShell />;
  return <PlanShell />;
}
