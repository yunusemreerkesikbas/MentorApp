"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Footprints,
  GripVertical,
  Map as MapIcon,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type {
  CampusExperienceDto,
  CityDto,
  DatasetInfoDto,
  GeoResponseDto,
  PreferenceProgramSnapshotDto,
  PreferenceRankProfileDto,
  PreferenceScenarioItemDto,
  PreferenceSimulationAccessDto,
  PreferenceSimulationDto,
  PreferenceSimulationRefreshResultDto,
  ProgramCatalogSearchItemDto,
  ProgramCatalogSearchResponseDto,
  VisionDto,
  YksScoreType,
} from "@mentor/types";
import { YKS_SCORE_TYPES } from "@mentor/types";
import {
  ApiClientError,
  coachingControllerGetPreferenceSimulation,
  coachingControllerGetPreferenceSimulationAccess,
  coachingControllerGetVision,
  coachingControllerPutPreferenceSimulation,
  coachingControllerRefreshPreferenceSimulation,
  coachingControllerUpsertVision,
  geoControllerGetCampusExperience,
  geoControllerGetGeo,
  geoControllerSearchPrograms,
} from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { MapCanvas } from "@/components/turkey-map/map-canvas";

import { CampusWalkAvatar } from "./campus-walk-avatar";
import {
  initialCampusWalkState,
  reduceCampusWalkState,
} from "./campus-walk-state";
import type { CampusWalkAvailability } from "./campus-street-view";

const Campus3DMap = dynamic(
  () => import("./campus-3d-map").then((module) => module.Campus3DMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-[24rem] place-items-center bg-[var(--color-surface-soft)]" />
    ),
  },
);

const CampusStreetView = dynamic(
  () => import("./campus-street-view").then((module) => module.CampusStreetView),
  { ssr: false },
);

type PanelTab = "CAMPUS" | "PREFERENCES";
type SaveState = "IDLE" | "SAVING" | "SAVED" | "ERROR";
type CampusViewMode = "AERIAL" | "WALK";

const EMPTY_RANKS: PreferenceRankProfileDto = {
  SAY: null,
  EA: null,
  SÖZ: null,
  DİL: null,
  TYT: null,
};

function unwrap<T>(response: unknown): T | null {
  return ((response as { data?: T | null })?.data ?? response) as T | null;
}

export function SimulationShell({ universityId }: { universityId: string }) {
  const t = useTranslations("preferenceSimulation");
  const locale = useLocale();
  const reducedMotion = useReducedMotion() ?? false;
  const [access, setAccess] = useState<PreferenceSimulationAccessDto | null>(null);
  const [simulation, setSimulation] = useState<PreferenceSimulationDto | null>(null);
  const [campus, setCampus] = useState<CampusExperienceDto | null>(null);
  const [cities, setCities] = useState<CityDto[]>([]);
  const [geoDataset, setGeoDataset] = useState<DatasetInfoDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [tab, setTab] = useState<PanelTab>("CAMPUS");
  const [activePoiIndex, setActivePoiIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [freeRoam, setFreeRoam] = useState(false);
  const [viewMode, setViewMode] = useState<CampusViewMode>("AERIAL");
  const [walkAvailability, setWalkAvailability] =
    useState<CampusWalkAvailability>("CHECKING");
  const [walkState, dispatchWalkEvent] = useReducer(
    reduceCampusWalkState,
    initialCampusWalkState,
  );
  const [ranks, setRanks] = useState<PreferenceRankProfileDto>(EMPTY_RANKS);
  const [items, setItems] = useState<PreferenceScenarioItemDto[]>([]);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("IDLE");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchingMore, setSearchingMore] = useState(false);
  const [results, setResults] = useState<ProgramCatalogSearchItemDto[]>([]);
  const [resultQuery, setResultQuery] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [saveRetryTick, setSaveRetryTick] = useState(0);
  const [vision, setVision] = useState<VisionDto | null>(null);
  const [settingGoalUniversityId, setSettingGoalUniversityId] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const dirtyGenerationRef = useRef(0);
  const savingRef = useRef(false);
  const latestQueryRef = useRef("");
  const dragIndexRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void coachingControllerGetPreferenceSimulationAccess()
      .then(async (response) => {
        const nextAccess = unwrap<PreferenceSimulationAccessDto>(response);
        if (!active || !nextAccess) return;
        setAccess(nextAccess);
        if (!nextAccess.enabled) return;
        const [simulationResponse, campusResponse, geoResponse, visionResponse] =
          await Promise.allSettled([
            coachingControllerGetPreferenceSimulation(),
            geoControllerGetCampusExperience(universityId),
            geoControllerGetGeo(),
            coachingControllerGetVision(),
          ]);
        if (!active) return;
        if (simulationResponse.status === "rejected") {
          throw simulationResponse.reason;
        }
        const nextSimulation = unwrap<PreferenceSimulationDto>(
          simulationResponse.value,
        );
        if (!nextSimulation) throw new Error("simulation_payload_missing");
        setSimulation(nextSimulation);
        setRanks(nextSimulation.scenario?.ranks ?? EMPTY_RANKS);
        setItems(nextSimulation.scenario?.items ?? []);
        setRevision(nextSimulation.scenario?.revision ?? 0);
        setSaveState("SAVED");
        if (campusResponse.status === "fulfilled") {
          setCampus(unwrap<CampusExperienceDto>(campusResponse.value));
        } else {
          setMapFailed(true);
        }
        if (geoResponse.status === "fulfilled") {
          const geo = unwrap<GeoResponseDto>(geoResponse.value);
          setCities(geo?.cities ?? []);
          setGeoDataset(geo?.dataset ?? null);
        }
        if (visionResponse.status === "fulfilled") {
          setVision(unwrap<VisionDto>(visionResponse.value));
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(
          error instanceof ApiClientError ? error.body.message : t("load_error"),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t, universityId]);

  useEffect(() => {
    if (!playing || freeRoam || !campus) return;
    const timer = window.setInterval(() => {
      setActivePoiIndex((current) => {
        if (current >= campus.pois.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 4_500);
    return () => window.clearInterval(timer);
  }, [campus, freeRoam, playing]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    latestQueryRef.current = normalizedQuery;
    if (normalizedQuery.length < 2 || !access?.enabled) {
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void geoControllerSearchPrograms({ q: normalizedQuery, page: 1, pageSize: 20 })
        .then((response) => {
          if (!active) return;
          const result = unwrap<ProgramCatalogSearchResponseDto>(response);
          setResults(result?.items ?? []);
          setResultQuery(normalizedQuery);
          setSearchPage(result?.page ?? 1);
          setSearchTotal(result?.total ?? 0);
        })
        .catch(() => {
          if (active) {
            setResults([]);
            setResultQuery(normalizedQuery);
            setSearchPage(1);
            setSearchTotal(0);
          }
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [access?.enabled, query]);

  async function loadMorePrograms() {
    const normalizedQuery = query.trim();
    if (
      normalizedQuery.length < 2 ||
      normalizedQuery !== resultQuery ||
      results.length >= searchTotal ||
      searchingMore
    ) {
      return;
    }
    setSearchingMore(true);
    try {
      const response = await geoControllerSearchPrograms({
        q: normalizedQuery,
        page: searchPage + 1,
        pageSize: 20,
      });
      const result = unwrap<ProgramCatalogSearchResponseDto>(response);
      if (!result || latestQueryRef.current !== normalizedQuery) return;
      setResults((current) => [...current, ...result.items]);
      setSearchPage(result.page);
      setSearchTotal(result.total);
    } finally {
      if (latestQueryRef.current === normalizedQuery) setSearchingMore(false);
    }
  }

  const saveDraft = useCallback(async () => {
    if (
      !dirtyRef.current ||
      savingRef.current ||
      !simulation ||
      simulation.stale
    ) {
      return;
    }
    const savedGeneration = dirtyGenerationRef.current;
    let shouldRetry = false;
    dirtyRef.current = false;
    savingRef.current = true;
    setSaveState("SAVING");
    setSaveError(null);
    try {
      const response = await coachingControllerPutPreferenceSimulation({
        datasetVersion: simulation.dataset.version,
        expectedRevision: revision,
        ranks,
        programCodes: items.map((item) => item.snapshot.code),
      });
      const saved = unwrap<PreferenceSimulationDto>(response);
      if (!saved) throw new Error("simulation_payload_missing");
      setSimulation(saved);
      setRevision(saved.scenario?.revision ?? revision + 1);
      if (
        dirtyGenerationRef.current === savedGeneration &&
        !dirtyRef.current
      ) {
        setRanks(saved.scenario?.ranks ?? EMPTY_RANKS);
        setItems(saved.scenario?.items ?? []);
        setSaveState("SAVED");
      } else {
        shouldRetry = true;
        setSaveState("IDLE");
      }
    } catch (error) {
      dirtyRef.current = true;
      setSaveState("ERROR");
      setSaveError(
        error instanceof ApiClientError ? error.body.message : t("save_error"),
      );
    } finally {
      savingRef.current = false;
      if (shouldRetry) setSaveRetryTick((current) => current + 1);
    }
  }, [items, ranks, revision, simulation, t]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = window.setTimeout(() => void saveDraft(), 700);
    return () => window.clearTimeout(timer);
  }, [items, ranks, saveDraft, saveRetryTick]);

  const activePoi = campus?.pois[activePoiIndex] ?? null;
  const camera = freeRoam
    ? campus?.initialCamera
    : (activePoi?.camera ?? campus?.initialCamera);

  function selectCampusPoi(index: number) {
    setPlaying(false);
    setFreeRoam(false);
    setViewMode("AERIAL");
    setTab("CAMPUS");
    if (index === activePoiIndex) return;

    setWalkAvailability("CHECKING");
    const nextPoi = campus?.pois[index];
    if (nextPoi) {
      dispatchWalkEvent({ type: "POI_CHANGED", poiId: nextPoi.id });
    }
    setActivePoiIndex(index);
  }

  function mutateDraft(mutator: () => void) {
    if (simulation?.stale) return;
    dirtyRef.current = true;
    dirtyGenerationRef.current += 1;
    setSaveState("IDLE");
    mutator();
  }

  function setRank(type: YksScoreType, value: string) {
    const parsed = value === "" ? null : Number(value);
    mutateDraft(() =>
      setRanks((current) => ({
        ...current,
        [type]: parsed != null && Number.isInteger(parsed) ? parsed : null,
      })),
    );
  }

  function addProgram(program: ProgramCatalogSearchItemDto) {
    if (!simulation || items.some((item) => item.snapshot.code === program.code)) {
      return;
    }
    if (items.length >= simulation.dataset.officialPreferenceLimit) return;
    const snapshot: PreferenceProgramSnapshotDto = {
      ...program,
      position: items.length + 1,
      source: simulation.dataset.source,
      sourceUrl: simulation.dataset.sourceUrl,
      verifiedAt: simulation.dataset.verifiedAt,
    };
    mutateDraft(() =>
      setItems((current) => [
        ...current,
        {
          snapshot,
          comparison: {
            status: "NOT_COMPARABLE",
            reason: ranks[program.scoreType] ? "MISSING_PLACEMENT_RANK" : "MISSING_USER_RANK",
            userRank: ranks[program.scoreType],
            cutoffRank: program.successRank,
            delta: null,
            direction: null,
          },
        },
      ]),
    );
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    mutateDraft(() => {
      setItems((current) => {
        const next = [...current];
        const [moved] = next.splice(from, 1);
        if (!moved) return current;
        next.splice(to, 0, moved);
        return next.map((item, index) => ({
          ...item,
          snapshot: { ...item.snapshot, position: index + 1 },
        }));
      });
    });
  }

  async function refreshDraft() {
    if (!simulation?.scenario) return;
    setRefreshing(true);
    setSaveError(null);
    try {
      const response = await coachingControllerRefreshPreferenceSimulation({
        expectedRevision: revision,
      });
      const refreshed = unwrap<PreferenceSimulationRefreshResultDto>(response);
      if (!refreshed) throw new Error("simulation_payload_missing");
      setSimulation(refreshed);
      setRanks(refreshed.scenario?.ranks ?? EMPTY_RANKS);
      setItems(refreshed.scenario?.items ?? []);
      setRevision(refreshed.scenario?.revision ?? revision + 1);
      dirtyRef.current = false;
      setSaveState("SAVED");
    } catch (error) {
      setSaveError(
        error instanceof ApiClientError ? error.body.message : t("refresh_error"),
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function setAsVisionGoal(item: PreferenceScenarioItemDto) {
    setSettingGoalUniversityId(item.snapshot.universityId);
    setSaveError(null);
    try {
      const response = await coachingControllerUpsertVision({
        goalTitle: vision?.goalTitle ?? item.snapshot.name,
        targetCityCode: item.snapshot.cityCode,
        targetCity: vision?.targetCity ?? null,
        targetUniversityId: item.snapshot.universityId,
        targetTitleId: vision?.targetTitleId ?? null,
        targetInstitutionId: vision?.targetInstitutionId ?? null,
        careerGroup: vision?.careerGroup ?? null,
        motivation: vision?.motivation ?? null,
      });
      setVision(unwrap<VisionDto>(response));
    } catch (error) {
      setSaveError(
        error instanceof ApiClientError ? error.body.message : t("goal_error"),
      );
    } finally {
      setSettingGoalUniversityId(null);
    }
  }

  if (loading) {
    return <SimulationMessage title={t("loading")} />;
  }
  if (loadError) {
    return <SimulationMessage title={loadError} backLabel={t("back")} />;
  }
  if (!access?.enabled) {
    return (
      <SimulationMessage
        title={t(`access.${access?.reason ?? "FEATURE_DISABLED"}`)}
        backLabel={t("back")}
      />
    );
  }
  if (!simulation) {
    return <SimulationMessage title={t("load_error")} backLabel={t("back")} />;
  }

  return (
    <main className="relative flex h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom,0px))] min-h-0 flex-col overflow-hidden lg:h-dvh lg:flex-row">
      <section className="relative min-h-0 flex-1 bg-[var(--color-surface-soft)]" aria-label={t("map_label")}>
        {campus && camera && !mapFailed ? (
          <Campus3DMap
            campus={campus}
            camera={camera}
            activePoiId={activePoi?.id ?? null}
            locale={locale}
            reducedMotion={reducedMotion}
            onSelectPoi={(poiId) => {
              const index = campus.pois.findIndex((poi) => poi.id === poiId);
              if (index >= 0) selectCampusPoi(index);
            }}
            onError={() => setMapFailed(true)}
          />
        ) : (
          <div className="h-full min-h-[24rem]" data-testid="campus-map-fallback">
            <MapCanvas
              cities={cities}
              selectedCityCode="42"
              previewCityCode={null}
              spotlightUniversityId={universityId}
              visibleUniversityIds={null}
              dataset={geoDataset}
              activeUniversityId={universityId}
              overlay={null}
              onSelectCity={() => undefined}
              onSelectUniversity={() => undefined}
              onHoverUniversity={() => undefined}
            />
            <div className="absolute left-4 top-16 max-w-sm rounded-[var(--radius-card)] border bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]" style={{ borderColor: "var(--color-border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>{t("map_fallback")}</p>
            </div>
          </div>
        )}

        {campus && activePoi ? (
          <CampusStreetView
            active={viewMode === "WALK" && walkAvailability === "AVAILABLE"}
            poi={activePoi}
            locale={locale}
            onAvailabilityChange={(availability) => {
              setWalkAvailability(availability);
              if (availability === "UNAVAILABLE" || availability === "ERROR") {
                setViewMode("AERIAL");
              }
            }}
            onWalkEvent={dispatchWalkEvent}
          />
        ) : null}

        {viewMode === "WALK" && walkAvailability === "AVAILABLE" ? (
          <CampusWalkAvatar phase={walkState.phase} reducedMotion={reducedMotion} />
        ) : null}

        <div className="absolute left-3 top-3 z-30 flex items-center gap-2">
          <Link
            href="/vision-board"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[var(--color-surface)] shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            aria-label={t("back")}
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <span className="rounded-full bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold shadow-[var(--shadow-card)]" style={{ color: "var(--color-main)" }}>
            {campus?.universityName ?? t("selcuk_pilot")}
          </span>
        </div>

        {campus && activePoi ? (
          <CampusModeControl
            mode={viewMode}
            availability={walkAvailability}
            onSelectAerial={() => setViewMode("AERIAL")}
            onSelectWalk={() => {
              if (walkAvailability !== "AVAILABLE") return;
              setPlaying(false);
              setFreeRoam(false);
              setViewMode("WALK");
            }}
            t={t}
          />
        ) : null}

        {campus ? (
          <div className="absolute bottom-[48%] left-3 z-30 flex flex-wrap gap-2 lg:bottom-4">
            {viewMode === "AERIAL" ? (
              <MapControl
                label={playing ? t("tour.pause") : t("tour.play")}
                onClick={() => {
                  setFreeRoam(false);
                  setViewMode("AERIAL");
                  setPlaying((current) => !current);
                }}
                icon={playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              />
            ) : null}
            <MapControl
              label={t("tour.previous")}
              onClick={() => selectCampusPoi(Math.max(0, activePoiIndex - 1))}
              icon={<ChevronUp className="size-4" />}
            />
            <MapControl
              label={t("tour.next")}
              onClick={() =>
                selectCampusPoi(Math.min(campus.pois.length - 1, activePoiIndex + 1))
              }
              icon={<ChevronDown className="size-4" />}
            />
            {viewMode === "AERIAL" ? (
              <MapControl
                label={t("tour.free_roam")}
                onClick={() => {
                  setPlaying(false);
                  setViewMode("AERIAL");
                  setFreeRoam(true);
                }}
                icon={<RotateCcw className="size-4" />}
              />
            ) : null}
          </div>
        ) : null}
      </section>

      <aside className="absolute inset-x-0 bottom-0 z-20 flex max-h-[48%] min-h-[18rem] flex-col rounded-t-[var(--radius-card)] border-t bg-[var(--color-surface)] shadow-[var(--shadow-card)] lg:static lg:h-full lg:max-h-none lg:w-[26rem] lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0" style={{ borderColor: "var(--color-border)" }}>
        <div className="grid grid-cols-2 border-b p-2" style={{ borderColor: "var(--color-border)" }} role="tablist">
          {(["CAMPUS", "PREFERENCES"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className="min-h-11 rounded-[var(--radius-control)] px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                color: tab === value ? "var(--color-on-main)" : "var(--color-secondary)",
                backgroundColor: tab === value ? "var(--color-main)" : "transparent",
              }}
            >
              {t(`tabs.${value}`)}
            </button>
          ))}
        </div>

        <div className="mentor-scrollarea min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "CAMPUS" ? (
            <CampusPanel campus={campus} activePoiIndex={activePoiIndex} onSelect={selectCampusPoi} t={t} />
          ) : (
            <PreferencePanel
              simulation={simulation}
              ranks={ranks}
              items={items}
              query={query}
              searching={searching}
              searchingMore={searchingMore}
              results={results}
              resultQuery={resultQuery}
              searchTotal={searchTotal}
              saveState={saveState}
              saveError={saveError}
              refreshing={refreshing}
              visionUniversityId={vision?.targetUniversityId ?? null}
              settingGoalUniversityId={settingGoalUniversityId}
              setRank={setRank}
              setQuery={(value) => {
                setQuery(value);
                latestQueryRef.current = value.trim();
                if (value.trim().length < 2) {
                  setResults([]);
                  setResultQuery("");
                  setSearchTotal(0);
                }
              }}
              loadMorePrograms={() => void loadMorePrograms()}
              addProgram={addProgram}
              moveItem={moveItem}
              removeItem={(index) => mutateDraft(() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index)))}
              refreshDraft={() => void refreshDraft()}
              setAsVisionGoal={(item) => void setAsVisionGoal(item)}
              dragIndexRef={dragIndexRef}
              t={t}
            />
          )}
        </div>
      </aside>
    </main>
  );
}

function SimulationMessage({ title, backLabel }: { title: string; backLabel?: string }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-lg rounded-[var(--radius-card)] border bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-card)]" style={{ borderColor: "var(--color-border)" }}>
        <p className="font-semibold" style={{ color: "var(--color-main)" }}>{title}</p>
        {backLabel ? <Link href="/vision-board" className="mt-4 inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-4 font-semibold underline">{backLabel}</Link> : null}
      </div>
    </main>
  );
}

function MapControl({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-surface)] px-3 text-sm font-semibold shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" aria-label={label}>
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function CampusModeControl({
  mode,
  availability,
  onSelectAerial,
  onSelectWalk,
  t,
}: {
  mode: CampusViewMode;
  availability: CampusWalkAvailability;
  onSelectAerial: () => void;
  onSelectWalk: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const walkDisabled = availability !== "AVAILABLE";

  return (
    <div className="absolute right-3 top-16 z-30 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2 sm:top-3">
      <div
        className="grid grid-cols-2 rounded-full border bg-[var(--color-surface)] p-1 shadow-[var(--shadow-card)]"
        style={{ borderColor: "var(--color-border)" }}
        role="group"
        aria-label={t("walk.mode_label")}
      >
        <button
          type="button"
          aria-pressed={mode === "AERIAL"}
          onClick={onSelectAerial}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            backgroundColor:
              mode === "AERIAL" ? "var(--color-main)" : "transparent",
            color:
              mode === "AERIAL"
                ? "var(--color-on-main)"
                : "var(--color-secondary)",
          }}
        >
          <MapIcon className="size-4" aria-hidden />
          {t("walk.aerial")}
        </button>
        <button
          type="button"
          aria-pressed={mode === "WALK"}
          disabled={walkDisabled}
          onClick={onSelectWalk}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor:
              mode === "WALK" ? "var(--color-main)" : "transparent",
            color:
              mode === "WALK"
                ? "var(--color-on-main)"
                : "var(--color-secondary)",
          }}
        >
          <Footprints className="size-4" aria-hidden />
          {t("walk.street")}
        </button>
      </div>
      <p
        className="max-w-xs rounded-full bg-[var(--color-surface)] px-3 py-2 text-right text-xs font-semibold shadow-[var(--shadow-card)]"
        style={{
          color:
            availability === "ERROR"
              ? "var(--color-error)"
              : "var(--color-secondary)",
        }}
        aria-live="polite"
      >
        {t(`walk.status.${availability}`)}
      </p>
    </div>
  );
}

function CampusPanel({ campus, activePoiIndex, onSelect, t }: { campus: CampusExperienceDto | null; activePoiIndex: number; onSelect: (index: number) => void; t: ReturnType<typeof useTranslations> }) {
  if (!campus) return <p className="text-sm" style={{ color: "var(--color-secondary)" }}>{t("campus_unavailable")}</p>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}>{campus.universityName}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>{t("campus_intro")}</p>
      </div>
      <ol className="space-y-2">
        {campus.pois.map((poi, index) => (
          <li key={poi.id}>
            <button type="button" onClick={() => onSelect(index)} className="w-full rounded-[var(--radius-card)] border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" style={{ borderColor: index === activePoiIndex ? "var(--color-main)" : "var(--color-border)", backgroundColor: index === activePoiIndex ? "var(--color-surface-soft)" : "var(--color-surface)" }}>
              <span className="text-xs font-bold" style={{ color: "var(--color-secondary)" }}>{t("stop", { current: index + 1, total: campus.pois.length })}</span>
              <strong className="mt-1 block" style={{ color: "var(--color-main)" }}>{poi.title}</strong>
              <span className="mt-1 block text-sm" style={{ color: "var(--color-body)" }}>{poi.summary}</span>
            </button>
          </li>
        ))}
      </ol>
      <a href={campus.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold underline" style={{ color: "var(--color-main)" }}>{t("official_source")}</a>
    </div>
  );
}

function PreferencePanel({ simulation, ranks, items, query, searching, searchingMore, results, resultQuery, searchTotal, saveState, saveError, refreshing, visionUniversityId, settingGoalUniversityId, setRank, setQuery, loadMorePrograms, addProgram, moveItem, removeItem, refreshDraft, setAsVisionGoal, dragIndexRef, t }: {
  simulation: PreferenceSimulationDto;
  ranks: PreferenceRankProfileDto;
  items: PreferenceScenarioItemDto[];
  query: string;
  searching: boolean;
  searchingMore: boolean;
  results: ProgramCatalogSearchItemDto[];
  resultQuery: string;
  searchTotal: number;
  saveState: SaveState;
  saveError: string | null;
  refreshing: boolean;
  visionUniversityId: string | null;
  settingGoalUniversityId: string | null;
  setRank: (type: YksScoreType, value: string) => void;
  setQuery: (value: string) => void;
  loadMorePrograms: () => void;
  addProgram: (program: ProgramCatalogSearchItemDto) => void;
  moveItem: (from: number, to: number) => void;
  removeItem: (index: number) => void;
  refreshDraft: () => void;
  setAsVisionGoal: (item: PreferenceScenarioItemDto) => void;
  dragIndexRef: React.MutableRefObject<number | null>;
  t: ReturnType<typeof useTranslations>;
}) {
  const number = useMemo(() => new Intl.NumberFormat(), []);
  const visibleResults = resultQuery === query.trim() ? results : [];
  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold" style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}>{t("preferences.title")}</h1>
          <span className="text-xs font-semibold" aria-live="polite" style={{ color: saveState === "ERROR" ? "var(--color-error)" : "var(--color-secondary)" }}>{t(`save_state.${saveState}`)}</span>
        </div>
        <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>{t("preferences.disclaimer")}</p>
      </header>

      {simulation.stale ? (
        <div className="rounded-[var(--radius-card)] border p-3" style={{ borderColor: "var(--color-warning)" }}>
          <p className="text-sm" style={{ color: "var(--color-body)" }}>{t("stale", { removeCount: simulation.refreshSummary?.removableProgramCodes.length ?? 0 })}</p>
          <Button className="mt-3" busy={refreshing} onClick={refreshDraft}>{t("refresh")}</Button>
        </div>
      ) : null}

      <fieldset disabled={simulation.stale} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold" style={{ color: "var(--color-main)" }}>{t("ranks.title")}</legend>
        {YKS_SCORE_TYPES.map((type) => (
          <label key={type} className="flex flex-col gap-1 text-sm font-semibold" style={{ color: "var(--color-main)" }}>
            {type}
            <input type="number" min={1} max={9_999_999} inputMode="numeric" value={ranks[type] ?? ""} onChange={(event) => setRank(type, event.target.value)} placeholder={t("ranks.placeholder")} className="min-h-11 rounded-[var(--radius-control)] border bg-[var(--color-surface)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" style={{ borderColor: "var(--color-border)", color: "var(--color-body)" }} />
          </label>
        ))}
      </fieldset>

      <div>
        <label className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
          {t("search.label")}
          <input type="search" disabled={simulation.stale} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search.placeholder")} className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border bg-[var(--color-surface)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" style={{ borderColor: "var(--color-border)", color: "var(--color-body)" }} />
        </label>
        {query.trim().length >= 2 ? (
          <div className="mt-2 max-h-52 overflow-y-auto rounded-[var(--radius-card)] border" style={{ borderColor: "var(--color-border)" }}>
            {searching ? <p className="p-3 text-sm">{t("search.searching")}</p> : visibleResults.length === 0 ? <p className="p-3 text-sm">{t("search.empty")}</p> : visibleResults.map((program) => {
              const added = items.some((item) => item.snapshot.code === program.code);
              return <div key={program.code} className="flex items-start justify-between gap-3 border-b p-3 last:border-b-0" style={{ borderColor: "var(--color-border)" }}><div className="min-w-0"><strong className="block text-sm" style={{ color: "var(--color-main)" }}>{program.name}</strong><span className="block text-xs" style={{ color: "var(--color-secondary)" }}>{program.universityName} · {program.scoreType}</span></div><button type="button" disabled={added || items.length >= simulation.dataset.officialPreferenceLimit} onClick={() => addProgram(program)} className="min-h-11 shrink-0 rounded-[var(--radius-control)] px-3 text-sm font-semibold disabled:opacity-50" style={{ color: "var(--color-main)" }}>{added ? t("search.added") : t("search.add")}</button></div>;
            })}
            {!searching && visibleResults.length > 0 && visibleResults.length < searchTotal ? (
              <button
                type="button"
                disabled={searchingMore}
                onClick={loadMorePrograms}
                className="min-h-11 w-full px-3 text-sm font-semibold disabled:opacity-50"
                style={{ color: "var(--color-main)" }}
              >
                {searchingMore ? t("search.searching") : t("search.more")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold" style={{ color: "var(--color-main)" }}>{t("list.title")}</h2>
          <span className="text-xs" style={{ color: "var(--color-secondary)" }}>{t("list.count", { count: items.length, limit: simulation.dataset.officialPreferenceLimit })}</span>
        </div>
        <ol className="mt-2 space-y-2">
          {items.map((item, index) => (
            <li key={item.snapshot.code} draggable={!simulation.stale} onDragStart={() => { dragIndexRef.current = index; }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndexRef.current != null) moveItem(dragIndexRef.current, index); dragIndexRef.current = null; }} onKeyDown={(event) => { if (event.altKey && event.key === "ArrowUp") { event.preventDefault(); moveItem(index, index - 1); } if (event.altKey && event.key === "ArrowDown") { event.preventDefault(); moveItem(index, index + 1); } }} tabIndex={simulation.stale ? -1 : 0} className="rounded-[var(--radius-card)] border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]" style={{ borderColor: "var(--color-border)" }} aria-label={t("list.reorder_aria", { name: item.snapshot.name, position: index + 1 })}>
              <div className="flex items-start gap-2">
                <GripVertical className="mt-1 size-4 shrink-0" aria-hidden style={{ color: "var(--color-secondary)" }} />
                <span className="mt-0.5 text-sm font-bold" style={{ color: "var(--color-main)" }}>{index + 1}</span>
                <div className="min-w-0 flex-1"><strong className="block text-sm" style={{ color: "var(--color-main)" }}>{item.snapshot.name}</strong><span className="block text-xs" style={{ color: "var(--color-secondary)" }}>{item.snapshot.universityName} · {item.snapshot.scoreType}</span><span className="mt-1 block text-xs font-semibold" style={{ color: "var(--color-body)" }}>{comparisonText(item, number, t, saveState !== "SAVED")}</span><button type="button" disabled={settingGoalUniversityId === item.snapshot.universityId} onClick={() => setAsVisionGoal(item)} className="mt-2 min-h-11 text-xs font-semibold underline disabled:opacity-50" style={{ color: "var(--color-main)" }}>{visionUniversityId === item.snapshot.universityId ? t("list.goal_set") : t("list.set_goal")}</button></div>
                <div className="flex shrink-0"><button type="button" disabled={index === 0 || simulation.stale} onClick={() => moveItem(index, index - 1)} aria-label={t("list.move_up")} className="min-h-11 min-w-11 disabled:opacity-30"><ChevronUp className="mx-auto size-4" /></button><button type="button" disabled={index === items.length - 1 || simulation.stale} onClick={() => moveItem(index, index + 1)} aria-label={t("list.move_down")} className="min-h-11 min-w-11 disabled:opacity-30"><ChevronDown className="mx-auto size-4" /></button><button type="button" disabled={simulation.stale} onClick={() => removeItem(index)} aria-label={t("list.remove")} className="min-h-11 min-w-11 disabled:opacity-30"><Trash2 className="mx-auto size-4" /></button></div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {saveError ? <p role="alert" className="text-sm" style={{ color: "var(--color-error)" }}>{saveError}</p> : null}
      <div className="rounded-[var(--radius-card)] bg-[var(--color-surface-soft)] p-3 text-xs" style={{ color: "var(--color-secondary)" }}><strong className="block" style={{ color: "var(--color-main)" }}>{simulation.dataset.source}</strong><a href={simulation.dataset.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center underline">{t("official_source")}</a></div>
    </div>
  );
}

function comparisonText(item: PreferenceScenarioItemDto, number: Intl.NumberFormat, t: ReturnType<typeof useTranslations>, pending: boolean): string {
  if (pending) return t("comparison.PENDING");
  const comparison = item.comparison;
  if (comparison.status === "NOT_COMPARABLE") return t(`comparison.${comparison.reason}`);
  const signedDelta = comparison.delta > 0 ? `+${number.format(comparison.delta)}` : number.format(comparison.delta);
  return t("comparison.value", { user: number.format(comparison.userRank), cutoff: number.format(comparison.cutoffRank), delta: signedDelta });
}
