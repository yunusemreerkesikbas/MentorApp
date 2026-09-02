"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, TextField } from "@mentor/ui";
import { useMentorToast } from "@/lib/mentor-toast";
import { assignTasks } from "@/lib/mentorship";

/** Today in the browser's local calendar, as `yyyy-mm-dd` for the date input's min. */
function todayLocalIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * One task at a time. A bulk composer is tempting, but a coach assigning ten things at once is
 * usually a plan, and plan-building is the next slice's problem; the API already takes an array.
 *
 * No description field: a coach's note would be free text the student never asked for on their own
 * plan, and the report deliberately carries titles only. Title, subject and date are the contract.
 */
export function AssignTaskForm({
  studentId,
  studentName,
  onAssigned,
}: {
  studentId: string;
  studentName: string;
  onAssigned: () => void;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [taskDate, setTaskDate] = useState(todayLocalIso());
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await assignTasks(studentId, [
        {
          title: title.trim(),
          subject: subject.trim() === "" ? null : subject.trim(),
          taskDate,
        },
      ]);
      toast.success({
        title: t("assign_done_title"),
        message: t("assign_done_body", { name: studentName }),
      });
      setTitle("");
      setSubject("");
      onAssigned();
    } catch (err) {
      toast.error({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold" style={{ color: "var(--color-main)" }}>
        {t("assign_title")}
      </h2>
      <p className="mb-3 text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("assign_body")}
      </p>
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <TextField
          label={t("assign_task_title")}
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t("assign_subject")}
            value={subject}
            maxLength={80}
            onChange={(event) => setSubject(event.target.value)}
          />
          {/* Native date input: a picker library for one field the coach uses twice a week is
              the kind of dependency that never earns its bundle. */}
          <TextField
            label={t("assign_date")}
            type="date"
            value={taskDate}
            min={todayLocalIso()}
            onChange={(event) => setTaskDate(event.target.value)}
          />
        </div>
        <div>
          <Button type="submit" busy={busy} disabled={title.trim() === ""}>
            {t("assign_action")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
