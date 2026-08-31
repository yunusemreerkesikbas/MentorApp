"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import {
  ANALYTICS_CONSENT_KEY,
  toWebVitalAnalyticsParams,
  trackProductEvent,
  type ProductAnalyticsParams,
} from "@/lib/analytics";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];
type WebVitalParams = ProductAnalyticsParams["web_vital"];

const pendingMetrics = new Map<WebVitalParams["metric_name"], WebVitalParams>();

function queueOrTrack(params: WebVitalParams) {
  const consent = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  if (consent === "accepted") {
    trackProductEvent("web_vital", params);
    return;
  }
  if (consent === null) pendingMetrics.set(params.metric_name, params);
}

function flushPendingMetrics() {
  if (window.localStorage.getItem(ANALYTICS_CONSENT_KEY) !== "accepted") return;
  for (const params of pendingMetrics.values()) {
    trackProductEvent("web_vital", params);
  }
  pendingMetrics.clear();
}

const reportWebVitals: ReportWebVitalsCallback = (metric) => {
  const params = toWebVitalAnalyticsParams({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
  });
  if (params) queueOrTrack(params);
};

export function WebVitalsReporter() {
  useEffect(() => {
    window.addEventListener("mentor:analytics-ready", flushPendingMetrics);
    const clearPending = () => pendingMetrics.clear();
    window.addEventListener("mentor:analytics-rejected", clearPending);
    return () => {
      window.removeEventListener("mentor:analytics-ready", flushPendingMetrics);
      window.removeEventListener("mentor:analytics-rejected", clearPending);
    };
  }, []);
  useReportWebVitals(reportWebVitals);
  return null;
}
