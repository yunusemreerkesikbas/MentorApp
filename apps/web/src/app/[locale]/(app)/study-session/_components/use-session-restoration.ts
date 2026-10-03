"use client";

import { useEffect, useRef } from "react";
import type { StudySessionDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { finalizeStudySession } from "@/lib/study-sessions";
import {
  clearActiveSession,
  readActiveSession,
  resolveResume,
  type ActiveSessionRecord,
  type ResumeResolution,
} from "@/lib/session-persistence";

type Resumable = Extract<
  ResumeResolution,
  { kind: "resume-focus" | "resume-break" | "resume-stopwatch" }
>;

/** Mount-only recovery; a transient finalize failure retains the record for retry. */
export function useSessionRestoration(options: {
  existingSessionId: string | null;
  autoStartExisting: boolean;
  onExisting: (id: string) => void;
  onRecord: (record: ActiveSessionRecord) => void;
  onResume: (record: ActiveSessionRecord, resolution: Resumable) => void;
  onFinalized: (session: StudySessionDto) => void;
  onBusy: (busy: boolean) => void;
  onError: (error: unknown) => void;
}) {
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    const hydration = window.setTimeout(() => {
      if (restored.current) return;
      restored.current = true;
      const record = readActiveSession();
      if (!record) {
        if (options.existingSessionId && options.autoStartExisting)
          options.onExisting(options.existingSessionId);
        return;
      }
      const resolution = resolveResume(record, Date.now());
      if (resolution.kind === "discard" || resolution.kind === "done") {
        clearActiveSession();
        return;
      }
      options.onRecord(record);
      if (resolution.kind !== "finalize-expired") {
        options.onResume(record, resolution);
        return;
      }
      options.onBusy(true);
      finalizeStudySession(record.sessionId, {
        status: "COMPLETED",
        actualFocusSeconds: resolution.creditSeconds,
      })
        .then((session) => {
          clearActiveSession();
          options.onFinalized(session);
        })
        .catch((error: unknown) => {
          if (
            error instanceof ApiClientError &&
            (error.status === 409 || error.status === 404)
          ) {
            clearActiveSession();
            return;
          }
          options.onError(error);
        })
        .finally(() => options.onBusy(false));
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [options]);
}
