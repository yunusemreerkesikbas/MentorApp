"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { VisionDto } from "@mentor/types";
import {
  ApiClientError,
  coachingControllerGetVision,
  coachingControllerUpsertVision,
} from "@mentor/api-client";
import { Button, Card, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { useMentorDialog } from "@/lib/mentor-dialog";

const inputStyle = {
  borderColor: "var(--color-border, #e2e2e2)",
  color: "var(--color-body)",
  backgroundColor: "var(--color-surface, #fff)",
} as const;

/** Vision/goal board edit form — upsert the user's single goal anchor (text-based). */
export function HedefShell() {
  const translate = useTranslations("vision");
  const common = useTranslations("common");
  const { info } = useMentorDialog();
  const [goalTitle, setGoalTitle] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [motivation, setMotivation] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    coachingControllerGetVision()
      .then((res) => {
        if (!active) return;
        const dto =
          (res as unknown as { data?: VisionDto | null })?.data ??
          (res as unknown as VisionDto | null);
        if (dto) {
          setGoalTitle(dto.goalTitle);
          setTargetCity(dto.targetCity ?? "");
          setMotivation(dto.motivation ?? "");
        }
      })
      .catch(() => {
        /* new board — start empty */
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || goalTitle.trim().length === 0) return;
    setError(null);
    setSaving(true);
    try {
      await coachingControllerUpsertVision({
        goalTitle: goalTitle.trim(),
        targetCity: targetCity.trim() || null,
        motivation: motivation.trim() || null,
      });
      await info({
        title: translate("saved_info_title"),
        message: translate("saved_info_message"),
        okLabel: translate("saved_info_ok"),
      });
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.body.message
          : translate("save_error"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-8 lg:px-8 lg:py-10">
      <Link
        href="/panel"
        className="mb-4 inline-flex text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={{ color: "var(--color-secondary)" }}
      >
        {common("back_panel")}
      </Link>

      <Card>
        <SectionHeading subtitle={translate("page_subtitle")}>
          {translate("page_title")}
        </SectionHeading>

        {!loaded ? (
          <p className="mt-4 text-sm" style={{ color: "var(--color-secondary)" }}>
            {common("loading")}
          </p>
        ) : (
          <form className="mt-4 flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
                {translate("goal_label")}
              </span>
              <input
                type="text"
                value={goalTitle}
                maxLength={120}
                required
                disabled={saving}
                placeholder={translate("goal_placeholder")}
                onChange={(e) => setGoalTitle(e.target.value)}
                className="min-h-[44px] w-full rounded-[var(--radius-card)] border px-3 text-base"
                style={inputStyle}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
                {translate("city_label")}
              </span>
              <input
                type="text"
                value={targetCity}
                maxLength={80}
                disabled={saving}
                placeholder={translate("city_placeholder")}
                onChange={(e) => setTargetCity(e.target.value)}
                className="min-h-[44px] w-full rounded-[var(--radius-card)] border px-3 text-base"
                style={inputStyle}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
                {translate("motivation_label")}
              </span>
              <textarea
                value={motivation}
                maxLength={500}
                rows={3}
                disabled={saving}
                placeholder={translate("motivation_placeholder")}
                onChange={(e) => setMotivation(e.target.value)}
                className="w-full resize-none rounded-[var(--radius-card)] border px-3 py-2 text-base"
                style={inputStyle}
              />
            </label>

            <FormError message={error} />

            <Button type="submit" disabled={saving || goalTitle.trim().length === 0}>
              {saving ? translate("saving") : translate("save")}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
