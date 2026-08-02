"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import PanelLeft from "lucide-react/dist/esm/icons/panel-left.mjs";
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
import { HistorySideDrawer } from "@/components/history-side-panel";
import { MenuSelect } from "@/components/menu-select";
import { PuhuImage } from "@/components/puhu-image";
import { MapBrowser } from "@/components/turkey-map/map-browser";
import { MapCanvas } from "@/components/turkey-map/map-canvas";
import {
  UniversityHoverCard,
  type HoverAnchor,
} from "@/components/turkey-map/university-hover-card";
import { useAuth } from "@/lib/auth-context";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";

const fieldStyle = {
  borderColor: "var(--color-border, #e2e2e2)",
  color: "var(--color-body)",
  backgroundColor: "var(--color-surface, #fff)",
} as const;

const GOAL_INPUT_MAX_WIDTH = "18rem";
const CAREER_SELECT_WIDTH = "14rem";
/** Grace between pin ↔ hover card so the preview does not flash off mid-travel. */
const HOVER_HIDE_MS = 140;

function unwrap<T>(res: unknown): T | null {
  return ((res as { data?: T | null })?.data ?? (res as T | null)) as T | null;
}

/**
 * Goal board — a map with a search panel beside it and a thin form above it.
 *
 * Mobile: map-first; browse + goal form live in a left drawer (same pattern as coach/analysis).
 * Desktop (`lg+`): persistent left rail + top form (unchanged).
 */
export function VisionBoardShell() {
  const translate = useTranslations("vision");
  const map = useTranslations("vision.map");
  const common = useTranslations("common");
  const reduceMotion = useReducedMotion();
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
  /** Sidebar search hover — province highlight on the map (not a selection). */
  const [previewCityCode, setPreviewCityCode] = useState<string | null>(null);
  /** Sidebar search click — pin the university hover card while the map zooms. */
  const [spotlightUniversityId, setSpotlightUniversityId] = useState<string | null>(
    null,
  );
  /** Geo search → only matching campuses keep map pins (`null` = show all). */
  const [visibleUniversityIds, setVisibleUniversityIds] =
    useState<ReadonlySet<string> | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  /** Desktop rail vs mobile drawer — one MapBrowser mount; avoid dual search effects. */
  const [isLg, setIsLg] = useState(false);
  const isLgRef = useRef(false);
  const hoverHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancelHoverHide() {
    if (hoverHideTimer.current != null) {
      clearTimeout(hoverHideTimer.current);
      hoverHideTimer.current = null;
    }
  }

  function showUniversityHover(anchor: HoverAnchor) {
    cancelHoverHide();
    setHover(anchor);
  }

  function scheduleHoverHide() {
    // Spotlight cards stay until the focus is cleared — not a mouse-leave dismiss.
    if (spotlightUniversityId) return;
    cancelHoverHide();
    hoverHideTimer.current = setTimeout(() => {
      setHover(null);
      hoverHideTimer.current = null;
    }, HOVER_HIDE_MS);
  }

  function clearUniversityHover() {
    cancelHoverHide();
    setHover(null);
  }

  function clearMapFocus() {
    setPreviewCityCode(null);
    setSpotlightUniversityId(null);
    clearUniversityHover();
  }

  /** Open the browse drawer on mobile only — desktop keeps the persistent rail. */
  function openBrowsePanel() {
    if (isLgRef.current) return;
    setPanelOpen(true);
  }

  useEffect(() => {
    return () => cancelHoverHide();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      isLgRef.current = mq.matches;
      setIsLg(mq.matches);
      if (mq.matches) setPanelOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (targetCityCode == null) {
      setPreviewCityCode(null);
      setSpotlightUniversityId(null);
    }
  }, [targetCityCode]);

  const selectedCity = targetCityCode
    ? (cities.find((c) => c.code === targetCityCode) ?? null)
    : null;
  const showUniversities = user?.examType === "YKS";
  const targetSummary = targetUniversity
    ? targetUniversity.name
    : selectedCity
      ? selectedCity.name
      : null;

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

  function handleSelectCity(code: string | null) {
    if (code == null) {
      setTargetCityCode(null);
      setTargetUniversity(null);
      clearMapFocus();
      setOpenUniversity(null);
      return;
    }
    setTargetCityCode(code);
    // The previously chosen university belongs to the old city; keeping it would let the form
    // submit a pair the server has to reject.
    if (targetUniversity && !cityHasUniversity(cities, code, targetUniversity.id)) {
      setTargetUniversity(null);
    }
  }

  function handleFocusCampus(payload: {
    cityCode: string;
    university: UniversityDto;
  }) {
    setPreviewCityCode(null);
    setSpotlightUniversityId(payload.university.id);
    handleSelectCity(payload.cityCode);
    setOpenUniversity(payload.university);
    openBrowsePanel();
  }

  const mascot = <PuhuImage variant="proud" career={careerGroup} size="md" />;
  const careerLabelId = "vision-career-label";
  const careerOptions = [
    { value: "", label: translate("career.none") },
    ...CAREER_GROUPS.map((group) => ({
      value: group,
      label: translate(`career.group.${group}`),
    })),
  ];

  const panelMotion = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "show" as const,
        variants: staggerListVariants,
      };

  const mapBrowser = loaded ? (
    <MapBrowser
      cities={cities}
      selectedCityCode={targetCityCode}
      openUniversity={openUniversity}
      targetUniversityId={targetUniversity?.id ?? null}
      onSelectCity={(code) => {
        handleSelectCity(code);
        openBrowsePanel();
      }}
      onOpenUniversity={(university) => {
        setOpenUniversity(university);
        openBrowsePanel();
      }}
      onCloseUniversity={() => {
        setOpenUniversity(null);
        setSpotlightUniversityId(null);
        clearUniversityHover();
      }}
      onSetTarget={setTargetUniversity}
      onPreviewCity={setPreviewCityCode}
      onFocusCampus={handleFocusCampus}
      onVisibleUniversityIdsChange={setVisibleUniversityIds}
    />
  ) : (
    <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
      {common("loading")}
    </p>
  );

  const goalFormFields = (
    <VisionGoalFields
      layout={isLg ? "bar" : "stack"}
      goalTitle={goalTitle}
      onGoalTitleChange={setGoalTitle}
      careerGroup={careerGroup}
      onCareerGroupChange={setCareerGroup}
      careerLabelId={careerLabelId}
      careerOptions={careerOptions}
      selectedCity={selectedCity}
      targetUniversity={targetUniversity}
      onClearTarget={() => {
        setTargetCityCode(null);
        setTargetUniversity(null);
      }}
      saving={saving}
      error={error}
      clearTargetLabel={map("clear_target")}
    />
  );

  return (
    <main className="flex h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom,0px))] flex-col overflow-hidden lg:h-dvh lg:flex-row">
      {isLg ? (
        <motion.div
          className="mentor-scrollarea flex h-full w-[340px] shrink-0 flex-col gap-4 overflow-y-auto border-r p-5"
          style={{ borderColor: "var(--color-border, #e2e2e2)" }}
          {...panelMotion}
        >
          <motion.div
            className="flex flex-col gap-1"
            variants={reduceMotion ? undefined : staggerItemVariants}
          >
            <h1
              className="text-xl font-bold"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              {translate("page_title")}
            </h1>
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {translate("page_subtitle")}
            </p>
          </motion.div>

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            {mapBrowser}
          </motion.div>
        </motion.div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile chrome — thin strip; browse opens in the drawer. */}
        {!isLg ? (
          <div
            className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
            style={{ borderColor: "var(--color-border, #e2e2e2)" }}
          >
            <Link
              href="/dashboard"
              aria-label={common("back_panel")}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{ color: "var(--color-secondary)" }}
            >
              <ArrowLeft size={20} strokeWidth={2} aria-hidden />
            </Link>
            <h1
              className="min-w-0 flex-1 truncate text-base font-bold"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              {translate("page_title")}
            </h1>
            {targetSummary ? (
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="max-w-[7.5rem] truncate rounded-[var(--radius-card)] border px-2 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ borderColor: "var(--color-main)", color: "var(--color-main)" }}
              >
                {targetSummary}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              aria-label={translate("browse_open")}
              data-testid="vision-browse-open"
            >
              <PanelLeft
                className="size-5"
                style={{ color: "var(--color-main)" }}
                strokeWidth={2.25}
                aria-hidden
              />
            </button>
          </div>
        ) : null}

        {isLg ? (
          <motion.form
            className="flex shrink-0 flex-wrap items-end gap-3 border-b p-4"
            style={{ borderColor: "var(--color-border, #e2e2e2)" }}
            onSubmit={(e) => void handleSubmit(e)}
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {goalFormFields}
          </motion.form>
        ) : null}

        <div className="relative min-h-0 flex-1">
          <MapCanvas
            cities={showUniversities ? cities : stripUniversities(cities)}
            selectedCityCode={targetCityCode}
            previewCityCode={previewCityCode}
            spotlightUniversityId={spotlightUniversityId}
            visibleUniversityIds={visibleUniversityIds}
            showOsymSource={showUniversities}
            activeUniversityId={openUniversity?.id ?? targetUniversity?.id ?? null}
            overlay={targetCityCode ? { cityCode: targetCityCode, node: mascot } : null}
            onSelectCity={(code) => {
              // Province click clears pin spotlight; pin click re-sets it in onSelectUniversity
              // (same event — last write wins after batching).
              setSpotlightUniversityId(null);
              handleSelectCity(code);
              if (code != null) openBrowsePanel();
            }}
            onSelectUniversity={(university) => {
              // Pin click keeps the hover card active (same spotlight path as search focus).
              setSpotlightUniversityId(university.id);
              setOpenUniversity(university);
              openBrowsePanel();
            }}
            onHoverUniversity={(anchor) => {
              if (anchor) showUniversityHover(anchor);
              else scheduleHoverHide();
            }}
          />
          <UniversityHoverCard
            anchor={hover}
            active={
              hover != null && hover.university.id === spotlightUniversityId
            }
            onHoverRetain={cancelHoverHide}
            onHoverRelease={scheduleHoverHide}
            onOpen={(anchor) => {
              setSpotlightUniversityId(anchor.university.id);
              handleSelectCity(anchor.cityCode);
              setOpenUniversity(anchor.university);
              openBrowsePanel();
            }}
          />
          {/* With no city chosen there is nowhere on the map to stand, so the mascot waits here. */}
          {!targetCityCode ? (
            <div className="pointer-events-none absolute left-4 top-4">{mascot}</div>
          ) : null}
        </div>
      </div>

      {!isLg ? (
        <HistorySideDrawer
          open={panelOpen}
          onOpenChange={setPanelOpen}
          title={translate("page_title")}
          testId="vision-browse-drawer"
          headerActions={
            // Form sits outside the scroll pane so MenuSelect is not clipped by overflow-y-auto.
            <form
              className="flex flex-col gap-3 pb-1"
              onSubmit={(e) => void handleSubmit(e)}
            >
              <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                {translate("page_subtitle")}
              </p>
              {goalFormFields}
            </form>
          }
        >
          {mapBrowser}
        </HistorySideDrawer>
      ) : null}
    </main>
  );
}

function VisionGoalFields({
  layout,
  goalTitle,
  onGoalTitleChange,
  careerGroup,
  onCareerGroupChange,
  careerLabelId,
  careerOptions,
  selectedCity,
  targetUniversity,
  onClearTarget,
  saving,
  error,
  clearTargetLabel,
}: {
  layout: "bar" | "stack";
  goalTitle: string;
  onGoalTitleChange: (value: string) => void;
  careerGroup: CareerGroup | null;
  onCareerGroupChange: (value: CareerGroup | null) => void;
  careerLabelId: string;
  careerOptions: Array<{ value: string; label: string }>;
  selectedCity: CityDto | null;
  targetUniversity: UniversityDto | null;
  onClearTarget: () => void;
  saving: boolean;
  error: string | null;
  clearTargetLabel: string;
}) {
  const translate = useTranslations("vision");
  const stack = layout === "stack";

  return (
    <>
      <label
        className={stack ? "flex w-full flex-col gap-1.5" : "flex w-full flex-col gap-1.5 sm:w-auto"}
        style={stack ? undefined : { maxWidth: GOAL_INPUT_MAX_WIDTH, flex: "1 1 12rem" }}
      >
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
          onChange={(e) => onGoalTitleChange(e.target.value)}
          className="min-h-11 w-full rounded-[var(--radius-card)] border px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={fieldStyle}
        />
      </label>

      <div
        className={stack ? "flex w-full flex-col gap-1.5" : "flex w-full flex-col gap-1.5 sm:w-auto"}
        style={stack ? undefined : { width: CAREER_SELECT_WIDTH, maxWidth: "100%" }}
      >
        <span
          id={careerLabelId}
          className="text-sm font-semibold"
          style={{ color: "var(--color-main)" }}
        >
          {translate("career.label")}
        </span>
        <MenuSelect
          value={careerGroup ?? ""}
          disabled={saving}
          aria-labelledby={careerLabelId}
          options={careerOptions}
          onChange={(next) =>
            onCareerGroupChange((next || null) as CareerGroup | null)
          }
        />
      </div>

      {selectedCity ? (
        <span
          className="flex min-h-11 max-w-full items-center gap-2 rounded-[var(--radius-card)] border px-3 text-sm font-semibold"
          style={{ borderColor: "var(--color-main)", color: "var(--color-main)" }}
        >
          <span className="min-w-0 truncate">
            {targetUniversity ? targetUniversity.name : selectedCity.name}
          </span>
          <button
            type="button"
            onClick={onClearTarget}
            aria-label={clearTargetLabel}
            className="shrink-0 cursor-pointer transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: "var(--color-secondary)" }}
          >
            ✕
          </button>
        </span>
      ) : null}

      <Button
        type="submit"
        busy={saving}
        disabled={goalTitle.trim().length === 0}
        className="!min-h-11 !px-5 !py-0 text-sm"
      >
        {saving ? translate("saving") : translate("save")}
      </Button>

      <div className="w-full">
        <FormError message={error} />
      </div>
    </>
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
