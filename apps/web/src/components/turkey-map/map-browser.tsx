"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  CityDto,
  GeoSearchResultDto,
  ProgramDto,
  UniversityDto,
  UniversityProgramsDto,
} from "@mentor/types";
import { geoControllerGetUniversityPrograms } from "@mentor/api-client";
import { apiBaseUrl } from "@/lib/api-base";

/** Long enough that typing a word is one request, short enough to feel immediate. */
const SEARCH_DEBOUNCE_MS = 250;

function unwrap<T>(res: unknown): T | null {
  return ((res as { data?: T | null })?.data ?? (res as T | null)) as T | null;
}

/**
 * Plain fetch rather than the generated client: `createZodDto` carries no Swagger metadata, so
 * orval emits every query-param endpoint in this repo without its params (`listExams` and
 * `listArticles` are the same). The endpoint is public, so there is nothing to authenticate.
 */
async function searchGeo(q: string, signal: AbortSignal): Promise<GeoSearchResultDto> {
  const res = await fetch(
    `${apiBaseUrl()}/v1/content/geo/search?q=${encodeURIComponent(q)}`,
    { signal },
  );
  if (!res.ok) throw new Error(`Geo search failed: ${res.status}`);
  return (await res.json()) as GeoSearchResultDto;
}

/**
 * Search + browse panel that lives beside the map.
 *
 * It shows one of three things, in priority order: an open university (with its programs), search
 * results, or the selected city's universities. The map and this panel drive the same state, so
 * clicking a pin and clicking a list row land in exactly the same place.
 */
export function MapBrowser({
  cities,
  selectedCityCode,
  openUniversity,
  targetUniversityId,
  onSelectCity,
  onOpenUniversity,
  onCloseUniversity,
  onSetTarget,
}: {
  cities: CityDto[];
  selectedCityCode: string | null;
  openUniversity: UniversityDto | null;
  targetUniversityId: string | null;
  onSelectCity: (code: string) => void;
  onOpenUniversity: (university: UniversityDto) => void;
  onCloseUniversity: () => void;
  onSetTarget: (university: UniversityDto | null) => void;
}) {
  const t = useTranslations("vision.map");
  const [query, setQuery] = useState("");
  /**
   * Results are kept WITH the query they answer, and only shown when the two still agree.
   * Storing the payload alone meant that deleting "konya" down to "ka" re-displayed the old hits
   * for the debounce interval, as if they matched what was now typed.
   */
  const [results, setResults] = useState<{
    query: string;
    data: GeoSearchResultDto;
  } | null>(null);
  /**
   * Keyed by the university it belongs to, so "is this loaded?" is derived rather than tracked.
   * A separate `loading` flag would have to be flipped synchronously inside the effect, which is
   * both an extra render and the thing `react-hooks/set-state-in-effect` warns about.
   */
  const [detail, setDetail] = useState<{
    id: string;
    data: UniversityProgramsDto | null;
  } | null>(null);

  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length >= 2;
  const activeResults =
    results && results.query === trimmedQuery ? results.data : null;

  const city = useMemo(
    () => cities.find((c) => c.code === selectedCityCode) ?? null,
    [cities, selectedCityCode],
  );

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchGeo(trimmedQuery, controller.signal)
        .then((data) => setResults({ query: trimmedQuery, data }))
        // Aborted keystrokes land here too; either way there is nothing useful to show.
        .catch(() => undefined);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmedQuery, searching]);

  const openId = openUniversity?.id ?? null;
  const loadedDetail = detail?.id === openId ? detail.data : null;
  const detailLoading = openId != null && detail?.id !== openId;

  useEffect(() => {
    if (!openId) return;
    let cancelled = false;
    void geoControllerGetUniversityPrograms(openId)
      .then((res) => {
        if (!cancelled) setDetail({ id: openId, data: unwrap(res) });
      })
      // Record the failure against the same id so it stops loading; the header still renders
      // from the university we already hold, just without its programs.
      .catch(() => {
        if (!cancelled) setDetail({ id: openId, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [openId]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search_placeholder")}
        aria-label={t("search_placeholder")}
        className="min-h-[44px] w-full rounded-[var(--radius-card)] border px-3 text-base"
        style={{
          borderColor: "var(--color-border, #e2e2e2)",
          color: "var(--color-body)",
          backgroundColor: "var(--color-surface, #fff)",
        }}
      />

      {openUniversity ? (
        <UniversityDetail
          university={openUniversity}
          detail={loadedDetail}
          loading={detailLoading}
          isTarget={openUniversity.id === targetUniversityId}
          onBack={onCloseUniversity}
          onSetTarget={onSetTarget}
        />
      ) : searching ? (
        <SearchResults
          results={activeResults}
          onCity={(code) => {
            onSelectCity(code);
            setQuery("");
          }}
          onUniversity={(u) => {
            setQuery("");
            onOpenUniversity(u);
          }}
        />
      ) : (
        <CityUniversities city={city} onUniversity={onOpenUniversity} />
      )}
    </div>
  );
}

function SearchResults({
  results,
  onCity,
  onUniversity,
}: {
  /** Null while the debounce is still in flight for the current query. */
  results: GeoSearchResultDto | null;
  onCity: (code: string) => void;
  onUniversity: (university: UniversityDto) => void;
}) {
  const t = useTranslations("vision.map");

  if (!results) {
    return (
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("searching")}
      </p>
    );
  }

  const empty =
    results.cities.length === 0 &&
    results.universities.length === 0 &&
    results.programs.length === 0;

  if (empty) {
    return (
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("search_empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {results.cities.length > 0 ? (
        <Group title={t("group_cities")}>
          {results.cities.map((c) => (
            <ResultRow key={c.code} onClick={() => onCity(c.code)} title={c.name} />
          ))}
        </Group>
      ) : null}

      {results.universities.length > 0 ? (
        <Group title={t("group_universities")}>
          {results.universities.map((u) => (
            <ResultRow
              key={u.id}
              onClick={() => onUniversity(u)}
              title={u.name}
              subtitle={t("program_count", { count: u.programCount })}
            />
          ))}
        </Group>
      ) : null}

      {results.programs.length > 0 ? (
        <Group title={t("group_programs")}>
          {results.programs.map((p) => (
            <ResultRow
              key={p.code}
              title={p.name}
              subtitle={`${p.universityName} · ${p.cityName}`}
            />
          ))}
        </Group>
      ) : null}
    </div>
  );
}

function CityUniversities({
  city,
  onUniversity,
}: {
  city: CityDto | null;
  onUniversity: (university: UniversityDto) => void;
}) {
  const t = useTranslations("vision.map");

  if (!city) {
    return (
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("card_empty")}
      </p>
    );
  }

  if (city.universities.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("no_universities")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-xs font-bold uppercase"
        style={{ color: "var(--color-secondary)" }}
      >
        {city.name} · {t("university_count", { count: city.universities.length })}
      </span>
      {city.universities.map((u) => (
        <ResultRow
          key={u.id}
          onClick={() => onUniversity(u)}
          title={u.name}
          subtitle={t("program_count", { count: u.programCount })}
        />
      ))}
    </div>
  );
}

function UniversityDetail({
  university,
  detail,
  loading,
  isTarget,
  onBack,
  onSetTarget,
}: {
  university: UniversityDto;
  detail: UniversityProgramsDto | null;
  loading: boolean;
  isTarget: boolean;
  onBack: () => void;
  onSetTarget: (university: UniversityDto | null) => void;
}) {
  const t = useTranslations("vision.map");

  const byFaculty = useMemo(() => {
    const groups = new Map<string, ProgramDto[]>();
    for (const program of detail?.programs ?? []) {
      const list = groups.get(program.faculty) ?? [];
      list.push(program);
      groups.set(program.faculty, list);
    }
    return [...groups.entries()];
  }, [detail]);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onBack}
        className="w-fit cursor-pointer text-xs font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={{ color: "var(--color-secondary)" }}
      >
        {t("back_to_city")}
      </button>

      <div className="flex flex-col gap-0.5">
        <span className="text-base font-bold" style={{ color: "var(--color-main)" }}>
          {university.name}
        </span>
        <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {t(`kind.${university.kind}`)} ·{" "}
          {t("program_count", { count: university.programCount })}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onSetTarget(isTarget ? null : university)}
        className="min-h-[40px] w-full cursor-pointer rounded-[var(--radius-card)] px-3 text-sm font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={
          isTarget
            ? {
                border: "2px solid var(--color-main)",
                color: "var(--color-main)",
              }
            : { backgroundColor: "var(--color-main)", color: "#fff" }
        }
      >
        {isTarget ? t("target_selected") : t("set_target")}
      </button>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("loading_programs")}
        </p>
      ) : (
        byFaculty.map(([faculty, programs]) => (
          <div key={faculty} className="flex flex-col gap-1">
            <span
              className="text-xs font-bold uppercase"
              style={{ color: "var(--color-secondary)" }}
            >
              {faculty}
            </span>
            {programs.map((program) => (
              <ProgramRow key={program.code} program={program} />
            ))}
          </div>
        ))
      )}

      {detail?.source ? (
        <p className="text-[11px]" style={{ color: "var(--color-secondary)" }}>
          {t("program_source", {
            source: detail.source.source,
            year: new Date(detail.source.verifiedAt).getFullYear(),
          })}
        </p>
      ) : null}
    </div>
  );
}

function ProgramRow({ program }: { program: ProgramDto }) {
  const t = useTranslations("vision.map");
  const latest = program.scores[0];

  return (
    <div
      className="flex flex-col gap-0.5 rounded-[var(--radius-card)] px-2 py-1.5"
      style={{ backgroundColor: "color-mix(in srgb, var(--color-chip) 18%, transparent)" }}
    >
      <span className="text-sm" style={{ color: "var(--color-body)" }}>
        {program.name}
      </span>
      <span className="text-[11px]" style={{ color: "var(--color-secondary)" }}>
        {program.scoreType} · {t("quota", { count: program.quota, year: program.guideYear })}
        {latest?.minScore != null
          ? ` · ${t("min_score", { year: latest.year, score: latest.minScore.toFixed(2) })}`
          : ` · ${t("no_placement")}`}
      </span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-xs font-bold uppercase"
        style={{ color: "var(--color-secondary)" }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

function ResultRow({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  const content = (
    <span className="flex flex-col gap-0.5 text-left">
      <span className="text-sm" style={{ color: "var(--color-body)" }}>
        {title}
      </span>
      {subtitle ? (
        <span className="text-[11px]" style={{ color: "var(--color-secondary)" }}>
          {subtitle}
        </span>
      ) : null}
    </span>
  );

  if (!onClick) {
    return <span className="block px-2 py-1.5">{content}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer rounded-[var(--radius-card)] px-2 py-1.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--color-chip)_25%,transparent)] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
    >
      {content}
    </button>
  );
}
