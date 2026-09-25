"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { useRouter } from "@/i18n/navigation";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { endStudentLink, fetchStudentReport, setAttention } from "@/lib/mentorship";
import { withAttention } from "../../../_components/attention";

type Report = MentorshipStudentReportDto;

/**
 * One student's report and the two acts on the whole student: the coach's mark and ending the link.
 *
 * A reload keeps the report on screen until the new one lands, so assigning a week does not blank
 * the page. A failed load is kept as the error itself and said in place; there is no toast for it.
 */
export function useStudentReport(studentId: string) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const { error: toastError } = useMentorToast();
  const dialog = useMentorDialog();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const [marking, setMarking] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchStudentReport(studentId)
      .then((next) => {
        if (!alive) return;
        setReport(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (alive) setError(err);
      });
    return () => {
      alive = false;
    };
  }, [studentId, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  /** After a failed first load: back to the skeleton while the page asks again. */
  const retry = useCallback(() => {
    setError(null);
    setRevision((value) => value + 1);
  }, []);

  const toast = useCallback(
    (err: unknown) =>
      toastError({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      }),
    [common, toastError],
  );

  /** Optimistic like the roster's: a round trip between deciding and seeing is the friction the mark removes. */
  const toggleAttention = useCallback(
    async (attended: boolean) => {
      if (!report) return;
      const before = report;
      setMarking(true);
      setReport(withAttention(before, attended));
      try {
        await setAttention(studentId, attended);
      } catch (err) {
        setReport(before);
        toast(err);
      } finally {
        setMarking(false);
      }
    },
    [report, studentId, toast],
  );

  const endLink = useCallback(async () => {
    if (!report) return;
    const confirmed = await dialog.confirm({
      title: t("report_end_confirm_title"),
      message: t("report_end_confirm_body", { name: report.studentDisplayName }),
      confirmLabel: t("report_end_confirm_action"),
      cancelLabel: t("confirm_cancel"),
    });
    if (!confirmed) return;
    setEnding(true);
    try {
      await endStudentLink(studentId);
      router.replace("/students");
    } catch (err) {
      toast(err);
      setEnding(false);
    }
  }, [dialog, report, router, studentId, t, toast]);

  return {
    report,
    /** Only while nothing is on screen: a failed reload leaves the loaded report where it is. */
    error: report === null ? error : null,
    reload,
    retry,
    setReport,
    marking,
    toggleAttention,
    ending,
    endLink,
  };
}
