"use client";

import { useEffect, useMemo, useState } from "react";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import { useTranslations } from "next-intl";
import type {
  CityDto,
  GeoSearchResultDto,
  ProgramDto,
  ProgramSearchHitDto,
  UniversityDto,
  UniversityProgramsDto,
  UniversitySearchHitDto,
} from "@mentor/types";
import { geoControllerGetUniversityPrograms } from "@mentor/api-client";
import { apiBaseUrl } from "@/lib/api-base";
import { universityIdsMatchingSearch } from "./search-pin-filter";

/** Long enough that typing a word is one request, short enough to feel immediate. */
const SEARCH_DEBOUNCE_MS = 250;

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase("tr");
}

/** Name, faculty, or score type — local filter while a university is open. */
function programMatchesQuery(program: ProgramDto, query: string): boolean {
  if (!query) return true;
  const needle = normalizeSearch(query);
  const hay = normalizeSearch(
    `${program.name} ${program.faculty} ${program.scoreType}`,
  );
  return hay.includes(needle);
}

function locateUniversity(
  cities: CityDto[],
  universityId: string,
): { cityCode: string; university: UniversityDto } | null {
  for (const city of cities) {
    const university = city.universities.find((u) => u.id === universityId);
    if (university) return { cityCode: city.code, university };
  }
  return null;
}

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
 * One search field, two modes: geo search (city / university / program) at the map level, and
 * local program filter when a university is open — a second bar would stack poorly in this rail.
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
  onPreviewCity,
  onFocusCampus,
  onVisibleUniversityIdsChange,
}: {
  cities: CityDto[];
  selectedCityCode: string | null;
  openUniversity: UniversityDto | null;
  targetUniversityId: string | null;
  onSelectCity: (code: string) => void;
  onOpenUniversity: (university: UniversityDto) => void;
  onCloseUniversity: () => void;
  onSetTarget: (university: UniversityDto | null) => void;
  /** Sidebar row hover → paint that province on the map (null clears). */
  onPreviewCity: (code: string | null) => void;
  /** Sidebar row click → select city + pin spotlight hover card + open campus. */
  onFocusCampus: (payload: {
    cityCode: string;
    university: UniversityDto;
  }) => void;
  /** `null` = show every pin; a Set filters the map to search-relevant campuses. */
  onVisibleUniversityIdsChange: (ids: ReadonlySet<string> | null) => void;
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

  const openId = openUniversity?.id ?? null;
  const filteringPrograms = openId != null;
  const trimmedQuery = query.trim();
  const searching = !filteringPrograms && trimmedQuery.length >= 2;
  const activeResults =
    results && results.query === trimmedQuery ? results.data : null;

  const city = useMemo(
    () => cities.find((c) => c.code === selectedCityCode) ?? null,
    [cities, selectedCityCode],
  );

  // Fresh field when opening/closing a university so geo text does not become a stale filter.
  useEffect(() => {
    setQuery("");
  }, [openId]);

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

  // Drive map pins from the same payload the sidebar lists — city hits keep every campus in
  // that province; university/program hits keep only those campuses.
  useEffect(() => {
    if (!searching) {
      onVisibleUniversityIdsChange(null);
      return;
    }
    if (!activeResults) return;
    onVisibleUniversityIdsChange(universityIdsMatchingSearch(activeResults, cities));
  }, [searching, activeResults, cities, onVisibleUniversityIdsChange]);

  // Drawer unmount (mobile) must not leave a stale pin filter on the full map.
  useEffect(() => {
    return () => onVisibleUniversityIdsChange(null);
  }, [onVisibleUniversityIdsChange]);

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

  const searchPlaceholder = filteringPrograms
    ? t("filter_programs_placeholder")
    : t("search_placeholder");

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="min-h-11 w-full rounded-[var(--radius-card)] border px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
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
          programQuery={trimmedQuery}
          isTarget={openUniversity.id === targetUniversityId}
          onBack={onCloseUniversity}
          onSetTarget={onSetTarget}
        />
      ) : searching ? (
        <SearchResults
          results={activeResults}
          onPreviewCity={onPreviewCity}
          onCity={(code) => {
            onPreviewCity(null);
            onSelectCity(code);
            setQuery("");
          }}
          onUniversity={(hit) => {
            // City context comes from the search hit — do not reverse-lookup the geo graph.
            onPreviewCity(null);
            onFocusCampus({ cityCode: hit.cityCode, university: hit });
            setQuery("");
          }}
          onProgram={(hit) => {
            // Program hits carry cityCode; full UniversityDto (coords for pin) still needs geo.
            const located = locateUniversity(cities, hit.universityId);
            onPreviewCity(null);
            if (located) {
              onFocusCampus(located);
              setQuery("");
              return;
            }
            onSelectCity(hit.cityCode);
            setQuery("");
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
  onPreviewCity,
  onCity,
  onUniversity,
  onProgram,
}: {
  /** Null while the debounce is still in flight for the current query. */
  results: GeoSearchResultDto | null;
  onPreviewCity: (code: string | null) => void;
  onCity: (code: string) => void;
  onUniversity: (hit: UniversitySearchHitDto) => void;
  onProgram: (hit: ProgramSearchHitDto) => void;
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
    <div
      className="flex flex-col gap-4"
      onMouseLeave={() => onPreviewCity(null)}
    >
      {results.cities.length > 0 ? (
        <Group title={t("group_cities")}>
          {results.cities.map((c) => (
            <ResultRow
              key={c.code}
              onClick={() => onCity(c.code)}
              onHoverStart={() => onPreviewCity(c.code)}
              title={c.name}
            />
          ))}
        </Group>
      ) : null}

      {results.universities.length > 0 ? (
        <Group title={t("group_universities")}>
          {results.universities.map((u) => (
            <ResultRow
              key={u.id}
              onClick={() => onUniversity(u)}
              onHoverStart={() => onPreviewCity(u.cityCode)}
              title={u.name}
              subtitle={`${u.cityName} · ${t("program_count", { count: u.programCount })}`}
            />
          ))}
        </Group>
      ) : null}

      {results.programs.length > 0 ? (
        <Group title={t("group_programs")}>
          {results.programs.map((p) => (
            <ResultRow
              key={p.code}
              onClick={() => onProgram(p)}
              onHoverStart={() => onPreviewCity(p.cityCode)}
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
  programQuery,
  isTarget,
  onBack,
  onSetTarget,
}: {
  university: UniversityDto;
  detail: UniversityProgramsDto | null;
  loading: boolean;
  /** Shared top-field query — filters this university's programs (not a second search bar). */
  programQuery: string;
  isTarget: boolean;
  onBack: () => void;
  onSetTarget: (university: UniversityDto | null) => void;
}) {
  const t = useTranslations("vision.map");

  const byFaculty = useMemo(() => {
    const groups = new Map<string, ProgramDto[]>();
    for (const program of detail?.programs ?? []) {
      if (!programMatchesQuery(program, programQuery)) continue;
      const list = groups.get(program.faculty) ?? [];
      list.push(program);
      groups.set(program.faculty, list);
    }
    return [...groups.entries()];
  }, [detail, programQuery]);

  const hasPrograms = (detail?.programs.length ?? 0) > 0;
  const filterEmpty = Boolean(programQuery) && hasPrograms && byFaculty.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back_to_city")}
          className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          style={{ color: "var(--color-secondary)" }}
        >
          <ArrowLeft size={20} strokeWidth={2} aria-hidden />
        </button>
        <div className="flex min-w-0 flex-col gap-0.5 pt-2">
          <span className="text-base font-bold leading-snug" style={{ color: "var(--color-main)" }}>
            {university.name}
          </span>
          <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
            {t(`kind.${university.kind}`)} ·{" "}
            {t("program_count", { count: university.programCount })}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSetTarget(isTarget ? null : university)}
        className="min-h-11 w-full cursor-pointer rounded-[var(--radius-card)] px-3 text-sm font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
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
      ) : filterEmpty ? (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("filter_programs_empty")}
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

/**
 * Program list row — name leads; score type / quota / cutoff stay as quiet secondary facts.
 * YKS students use those to compare departments; dropping them for a name-only list would look
 * cleaner but remove the reason this panel exists beside the map.
 */
function ProgramRow({ program }: { program: ProgramDto }) {
  const t = useTranslations("vision.map");
  const latest = program.scores[0];
  const meta = [
    program.scoreType,
    t("quota", { count: program.quota, year: program.guideYear }),
    latest?.minScore != null
      ? t("min_score", { year: latest.year, score: latest.minScore.toFixed(2) })
      : t("no_placement"),
  ].join(" · ");

  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius-card)] px-2.5 py-2 transition-colors hover:bg-black/[0.04] motion-reduce:transition-none">
      <span
        className="text-sm font-semibold leading-snug"
        style={{ color: "var(--color-main)" }}
      >
        {program.name}
      </span>
      <span className="text-[11px] leading-snug" style={{ color: "var(--color-secondary)" }}>
        {meta}
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
  onHoverStart,
}: {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  onHoverStart?: () => void;
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
      onMouseEnter={onHoverStart}
      onFocus={onHoverStart}
      className="w-full cursor-pointer rounded-[var(--radius-card)] px-2.5 py-2 text-left transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
    >
      {content}
    </button>
  );
}
