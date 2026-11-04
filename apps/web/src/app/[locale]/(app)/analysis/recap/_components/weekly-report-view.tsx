"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { WeeklyRecapReportDto } from "@mentor/types";
import { WeeklyRecapShell } from "./weekly-recap-shell";
import { WeeklyDeepAnalysis } from "./weekly-deep-analysis";

/** Both views reuse the acquired snapshot; switching never calls the access or generation API. */
export function WeeklyReportView({ report }: { report: WeeklyRecapReportDto }) {
  const search = useSearchParams();
  const [view, setView] = useState(() => search.get("view") === "analysis" ? "analysis" : "story");
  const switchView = (next: "analysis" | "story") => {
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
    window.scrollTo(0, 0);
    if (next === "analysis") window.requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-testid='weekly-deep-analysis'] h1")?.focus());
  };
  return view === "analysis" ? <WeeklyDeepAnalysis report={report} onStory={() => switchView("story")} />
    : <WeeklyRecapShell savedReport={report} onOpenAnalysis={() => switchView("analysis")} />;
}
