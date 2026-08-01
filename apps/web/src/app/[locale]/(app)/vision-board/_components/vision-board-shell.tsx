"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CAREER_GROUPS,
  type CareerGroup,
  type CityDto,
  type GeoResponseDto,
  type UniversityDto,
  type VisionDto,
} from "@mentor/types";
import {
  ApiClientError,
  coachingControllerGetVision,
  coachingControllerUpsertVision,
  geoControllerGetGeo,
} from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { PuhuImage } from "@/components/puhu-image";
import { MapBrowser } from "@/components/turkey-map/map-browser";
import { MapCanvas } from "@/components/turkey-map/map-canvas";
import {
  UniversityHoverCard,
  type HoverAnchor,
} from "@/components/turkey-map/university-hover-card";
import { useAuth } from "@/lib/auth-context";
import { useMentorDialog } from "@/lib/mentor-dialog";

const fieldStyle = {
  borderColor: "var(--color-border, #e2e2e2)",
  color: "var(--color-body)",
  backgroundColor: "var(--color-surface, #fff)",
} as const;

function unwrap<T>(res: unknown): T | null {
  return ((res as { data?: T | null })?.data ?? (res as T | null)) as T | null;
}

/**
 * Goal board — a map with a search panel beside it and a thin form above it.
 *
 * There is exactly one free-text field. The career group is deliberately NOT presented as a second
 * "what is your goal" question: it drives the mascot, so it is labelled and placed as the mascot's
 * control. Asking the same thing twice in two vocabularies was the confusing part, not the fields
 * themselves.
 *
 * City is chosen on the map or through the search panel, and shown as a chip — the search results
 * are ordinary buttons, so the keyboard path survives the removal of the old `<select>`.
 */
export function VisionBoardShell() {
  const translate = useTranslations("vision");
  const map = useTranslations("vision.map");
  const common = useTranslations("common");
  const { user } = useAuth();
  const { info } = useMentorDialog();

  const [goalTitle, setGoalTitle] = useState("");
  const [targetCityCode, setTargetCityCode] = useState<string | null>(null);
  const [targetUniversity, setTargetUniversity] = useState<UniversityDto | null>(null);
  const [careerGroup, setCareerGroup] = useState<CareerGroup | null>(null);
  /**
   * No longer editable here, but still round-tripped: saving `null` would silently erase the
   * motivation of every user who ever wrote one, on their next save.
   */
  const [motivation, setMotivation] = useState<string | null>(null);
  const [cities, setCities] = useState<CityDto[]>([]);
  const [openUniversity, setOpenUniversity] = useState<UniversityDto | null>(null);
  const [hover, setHover] = useState<HoverAnchor | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCity = targetCityCode
    ? (cities.find((c) => c.code === targetCityCode) ?? null)
    : null;
  const showUniversities = user?.examType === "YKS";

  useEffect(() => {
    let active = true;
    // Both in flight at once — the goal and the province list do not depend on each other, and
    // awaiting them in sequence would put a needless round-trip in front of first paint.
    void Promise.allSettled([
      coachingControllerGetVision(),
      geoControllerGetGeo(),
    ]).then(([visionRes, geoRes]) => {
      if (!active) return;
      const geo =
        geoRes.status === "fulfilled" ? unwrap<GeoResponseDto>(geoRes.value) : null;
      setCities(geo?.cities ?? []);

      if (visionRes.status === "fulfilled") {
        const dto = unwrap<VisionDto>(visionRes.value);
        if (dto) {
          setGoalTitle(dto.goalTitle);
          setTargetCityCode(dto.targetCityCode);
          setCareerGroup(dto.careerGroup);
          setMotivation(dto.motivation);
          // Resolve the saved university id against the list we just loaded, so the panel can
          // name it instead of showing a bare uuid.
          const saved = geo?.cities
            .flatMap((c) => c.universities)
            .find((u) => u.id === dto.targetUniversityId);
          setTargetUniversity(saved ?? null);
        }
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
        // The server re-checks that the university really sits in this city, so a mismatched pair
        // is rejected rather than stored.
        targetUniversityId: targetUniversity?.id ?? null,
        careerGroup,
        motivation,
      });
      await info({
        title: translate("saved_info_title"),
        message: translate("saved_info_message"),
        okLabel: translate("saved_info_ok"),
      });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.body.message : translate("save_error"),
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSelectCity(code: string) {
    setTargetCityCode(code);
    // The previously chosen university belongs to the old city; keeping it would let the form
    // submit a pair the server has to reject.
    if (targetUniversity && !cityHasUniversity(cities, code, targetUniversity.id)) {
      setTargetUniversity(null);
    }
  }

  const mascot = <PuhuImage variant="proud" career={careerGroup} size="md" />;

  return (
    <main className="flex min-h-[calc(100dvh-var(--app-header-h,0px))] flex-col lg:flex-row">
      <div
        className="mentor-scrollarea flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b p-5 lg:w-[340px] lg:border-b-0 lg:border-r"
        style={{ borderColor: "var(--color-border, #e2e2e2)" }}
      >
        <Link
          href="/dashboard"
          className="inline-flex text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{ color: "var(--color-secondary)" }}
        >
          {common("back_panel")}
        </Link>

        <div className="flex flex-col gap-1">
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {translate("page_title")}
          </h1>
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {translate("page_subtitle")}
          </p>
        </div>

        {loaded ? (
          <MapBrowser
            cities={cities}
            selectedCityCode={targetCityCode}
            openUniversity={openUniversity}
            targetUniversityId={targetUniversity?.id ?? null}
            onSelectCity={handleSelectCity}
            onOpenUniversity={setOpenUniversity}
            onCloseUniversity={() => setOpenUniversity(null)}
            onSetTarget={setTargetUniversity}
          />
        ) : (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {common("loading")}
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <form
          className="flex flex-wrap items-end gap-3 border-b p-4"
          style={{ borderColor: "var(--color-border, #e2e2e2)" }}
          onSubmit={(e) => void handleSubmit(e)}
        >
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
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
              style={fieldStyle}
            />
          </label>

          <label className="flex w-[200px] flex-col gap-1.5">
            <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
              {translate("career.label")}
            </span>
            <select
              value={careerGroup ?? ""}
              disabled={saving}
              onChange={(e) =>
                setCareerGroup((e.target.value || null) as CareerGroup | null)
              }
              className="min-h-[44px] w-full rounded-[var(--radius-card)] border px-3 text-base"
              style={fieldStyle}
            >
              <option value="">{translate("career.none")}</option>
              {CAREER_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {translate(`career.group.${group}`)}
                </option>
              ))}
            </select>
          </label>

          {selectedCity ? (
            <span
              className="flex min-h-[44px] items-center gap-2 rounded-[var(--radius-card)] border px-3 text-sm font-semibold"
              style={{ borderColor: "var(--color-main)", color: "var(--color-main)" }}
            >
              {targetUniversity ? targetUniversity.name : selectedCity.name}
              <button
                type="button"
                onClick={() => {
                  setTargetCityCode(null);
                  setTargetUniversity(null);
                }}
                aria-label={map("clear_target")}
                className="cursor-pointer transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
                style={{ color: "var(--color-secondary)" }}
              >
                ✕
              </button>
            </span>
          ) : null}

          <Button type="submit" disabled={saving || goalTitle.trim().length === 0}>
            {saving ? translate("saving") : translate("save")}
          </Button>

          <div className="w-full">
            <FormError message={error} />
          </div>
        </form>

        <div className="relative min-h-[50vh] flex-1 lg:min-h-0">
          <MapCanvas
            cities={showUniversities ? cities : stripUniversities(cities)}
            selectedCityCode={targetCityCode}
            activeUniversityId={openUniversity?.id ?? targetUniversity?.id ?? null}
            overlay={targetCityCode ? { cityCode: targetCityCode, node: mascot } : null}
            onSelectCity={handleSelectCity}
            onSelectUniversity={setOpenUniversity}
            onHoverUniversity={(university, rect) =>
              setHover(university && rect ? { university, rect } : null)
            }
          />
          <UniversityHoverCard anchor={hover} />
          {/* With no city chosen there is nowhere on the map to stand, so the mascot waits here. */}
          {!targetCityCode ? (
            <div className="pointer-events-none absolute left-4 top-4">{mascot}</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function cityHasUniversity(
  cities: CityDto[],
  cityCode: string,
  universityId: string,
): boolean {
  return (
    cities
      .find((c) => c.code === cityCode)
      ?.universities.some((u) => u.id === universityId) ?? false
  );
}

/** KPSS and LGS pick a city, not a campus — pins there would be noise. */
function stripUniversities(cities: CityDto[]): CityDto[] {
  return cities.map((city) => ({ ...city, universities: [] }));
}
