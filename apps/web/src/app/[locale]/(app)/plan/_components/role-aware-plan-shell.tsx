"use client";

import dynamic from "next/dynamic";
import { UserRole } from "@mentor/types";
import { useAuth } from "@/lib/auth-context";
import { CoachPlanSkeleton } from "./coach-plan-skeleton";

const CoachPlanShell = dynamic(
  () => import("./coach-plan-shell").then((module) => module.CoachPlanShell),
  { loading: () => <CoachPlanSkeleton /> },
);
const PlanShell = dynamic(
  () => import("./plan-shell").then((module) => module.PlanShell),
  { loading: () => <CoachPlanSkeleton /> },
);

/** Role selection is presentation only; every coach endpoint enforces W8 authorization. */
export function RoleAwarePlanShell() {
  const { status, user } = useAuth();

  if (status === "loading") return <CoachPlanSkeleton />;
  if (user?.roles.includes(UserRole.COACH)) return <CoachPlanShell />;
  return <PlanShell />;
}
