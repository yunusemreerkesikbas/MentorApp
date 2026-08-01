"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CAREER_GROUPS,
  type CareerGroup,
  type CityDto,
  type GeoResponseDto,
  type VisionDto,
} from "@mentor/types";
import {
  ApiClientError,
  coachingControllerGetVision,
  coachingControllerUpsertVision,
  geoControllerGetGeo,
} from "@mentor/api-client";
import { Button, Card, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { PuhuImage } from "@/components/puhu-image";
import { TurkeyMap } from "@/components/turkey-map/turkey-map";
import { useAuth } from "@/lib/auth-context";
import { useMentorDialog } from "@/lib/mentor-dialog";

const inputStyle = {
  borderColor: "var(--color-border, #e2e2e2)",
  color: "var(--color-body)",
  backgroundColor: "var(--color-surface, #fff)",
} as const;

function unwrap<T>(res: unknown): T | null {
  return (
    ((res as { data?: T | null })?.data ?? (res as T | null)) as T | null
  );
}

/** Vision/goal board edit form — upsert the user's single goal anchor. */
export function VisionBoardShell() {
  const translate = useTranslations("vision");
  const common = useTranslations("common");
  const { user } = useAuth();
  const { info } = useMentorDialog();
  const [goalTitle, setGoalTitle] = useState("");
  const [targetCityCode, setTargetCityCode] = useState<string | null>(null);
  const [careerGroup, setCareerGroup] = useState<CareerGroup | null>(null);
  const [motivation, setMotivation] = useState("");
  const [cities, setCities] = useState<CityDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Both in flight at once — the goal and the province list do not depend on each other, and
    // awaiting them in sequence would put a needless round-trip in front of first paint.
    void Promise.allSettled([
      coachingControllerGetVision(),
      geoControllerGetGeo(),
    ]).then(([visionRes, geoRes]) => {
      if (!active) return;
      if (visionRes.status === "fulfilled") {
        const dto = unwrap<VisionDto>(visionRes.value);
        if (dto) {
          setGoalTitle(dto.goalTitle);
          setTargetCityCode(dto.targetCityCode);
          setCareerGroup(dto.careerGroup);
          setMotivation(dto.motivation ?? "");
        }
      }
      if (geoRes.status === "fulfilled") {
        setCities(unwrap<GeoResponseDto>(geoRes.value)?.cities ?? []);
      }
      setLoaded(true);
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
        targetCityCode,
        motivation: motivation.trim() || null,
        careerGroup,
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
    <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8 lg:py-10">
      <Link
        href="/dashboard"
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
          <form className="mt-4 flex flex-col gap-5" onSubmit={(e) => void handleSubmit(e)}>
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

            <TurkeyMap
              cities={cities}
              selectedCode={targetCityCode}
              onSelect={setTargetCityCode}
              showUniversities={user?.examType === "YKS"}
              disabled={saving}
            />

            <div className="flex flex-col gap-2">
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-main)" }}
              >
                {translate("career.label")}
              </span>
              <div className="flex items-start gap-3">
                {/* Single-select, mirroring the onboarding exam step. "Undecided" is an explicit
                    option rather than a tap-the-selected-chip-again gesture: radio semantics have
                    no way to clear a choice, and a hidden gesture is not a discoverable one. */}
                <div
                  role="radiogroup"
                  aria-label={translate("career.label")}
                  className="flex flex-1 flex-wrap gap-2"
                >
                  {([null, ...CAREER_GROUPS] as const).map((group) => {
                    const active = group === careerGroup;
                    return (
                      <button
                        key={group ?? "none"}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={saving}
                        onClick={() => setCareerGroup(group)}
                        className="min-h-[40px] cursor-pointer rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 motion-reduce:transition-none"
                        style={{
                          border: active
                            ? "2px solid var(--color-main)"
                            : "1px solid transparent",
                          backgroundColor: active
                            ? "color-mix(in srgb, var(--color-chip) 45%, white)"
                            : "color-mix(in srgb, var(--color-chip) 30%, transparent)",
                          color: "var(--color-chip-text)",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {group
                          ? translate(`career.group.${group}`)
                          : translate("career.none")}
                      </button>
                    );
                  })}
                </div>
                <PuhuImage variant="proud" career={careerGroup} size="md" />
              </div>
            </div>

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
