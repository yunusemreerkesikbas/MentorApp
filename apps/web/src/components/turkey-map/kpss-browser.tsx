"use client";
import { ChevronDown } from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  CityDto,
  ExamVariant,
  GeoSearchResultDto,
  InstitutionDto,
  KpssPostingDto,
  KpssTargetsDto,
  TitleDto,
} from "@mentor/types";
import { geoControllerSearch } from "@mentor/api-client";
import { useCityPostings } from "./use-kpss-targets";

/** Long enough that typing a word is one request, short enough to feel immediate. */
const SEARCH_DEBOUNCE_MS = 250;

function unwrap<T>(res: unknown): T | null {
  return ((res as { data?: T | null })?.data ?? (res as T | null)) as T | null;
}

/**
 * Search + browse panel for a KPSS goal — the counterpart of `MapBrowser`, not a variant of it.
 *
 * The two exams do not share a shape: a YKS goal drills city → university → programme, while a
 * KPSS goal is a job title that exists independently of any province, optionally narrowed by an
 * institution. Forcing both through one component would have meant a prop for every branch.
 *
 * The title is the anchor and always selectable. The institution list is explicitly labelled with
 * the placement round, because it only covers whoever advertised in the imported guide — a user
 * whose target simply did not hire this round must still be able to set a goal.
 */
export function KpssBrowser({
  targets,
  cities,
  level,
  datasetId,
  selectedCityCode,
  targetTitleId,
  targetInstitutionId,
  onSelectCity,
  onSetTitle,
  onSetInstitution,
  onQueryChange,
}: {
  targets: KpssTargetsDto | null;
  cities: CityDto[];
  /** `users.examVariant` — vacancies the candidate cannot apply with are not theirs to see. */
  level: ExamVariant | null;
  /** Chosen reference edition; `null` = current. */
  datasetId: string | null;
  selectedCityCode: string | null;
  targetTitleId: string | null;
  targetInstitutionId: string | null;
  onSelectCity: (code: string) => void;
  onSetTitle: (title: TitleDto | null) => void;
  onSetInstitution: (institution: InstitutionDto | null) => void;
  /** Reported up so the map can filter its province pins by the same term. */
  onQueryChange: (query: string) => void;
}) {
  const t = useTranslations("vision.kpss");
  const [query, setQuery] = useState("");

  // Every write goes through here, including the clear-on-select ones, so the map filter can
  // never disagree with what the box shows.
  const updateQuery = (next: string) => {
    setQuery(next);
    onQueryChange(next);
  };
  const [results, setResults] = useState<{
    query: string;
    data: GeoSearchResultDto;
  } | null>(null);

  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length >= 2;
  const activeResults =
    results && results.query === trimmedQuery ? results.data : null;

  const postings = useCityPostings(selectedCityCode, level, datasetId, true);
  const city = useMemo(
    () => cities.find((c) => c.code === selectedCityCode) ?? null,
    [cities, selectedCityCode],
  );
  const cityCount = useMemo(
    () =>
      targets?.cityPostings.find((c) => c.cityCode === selectedCityCode) ?? null,
    [targets, selectedCityCode],
  );

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void geoControllerSearch(
        { q: trimmedQuery, family: "KPSS" },
        { signal: controller.signal },
      )
        .then((res) => {
          const data = unwrap<GeoSearchResultDto>(res);
          if (data) setResults({ query: trimmedQuery, data });
        })
        // Aborted keystrokes land here too; either way there is nothing useful to show.
        .catch(() => undefined);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmedQuery, searching]);

  // Drawer unmount (mobile) must not leave a stale pin filter on the full map.
  useEffect(() => {
    return () => onQueryChange("");
  }, [onQueryChange]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => updateQuery(e.target.value)}
        placeholder={t("search_placeholder")}
        aria-label={t("search_placeholder")}
        className="min-h-[44px] w-full rounded-[var(--radius-card)] border px-3 text-base"
        style={{
          borderColor: "var(--color-border)",
          color: "var(--color-body)",
          backgroundColor: "var(--color-surface)",
        }}
      />

      {searching ? (
        <SearchResults
          results={activeResults}
          targetTitleId={targetTitleId}
          targetInstitutionId={targetInstitutionId}
          onCity={(code) => {
            onSelectCity(code);
            updateQuery("");
          }}
          onTitle={(title) => {
            onSetTitle(title);
            updateQuery("");
          }}
          onInstitution={(institution) => {
            onSetInstitution(institution);
            updateQuery("");
          }}
        />
      ) : (
        <>
          <TitlePicker
            titles={targets?.titles ?? []}
            targetTitleId={targetTitleId}
            onSetTitle={onSetTitle}
          />

          {city ? (
            <div className="flex w-full min-w-0 flex-col gap-1">
              <span
                className="text-xs font-bold uppercase"
                style={{ color: "var(--color-secondary)" }}
              >
                {city.name}
                {cityCount
                  ? ` · ${t("city_summary", {
                      postings: cityCount.postings,
                      quota: cityCount.quota,
                    })}`
                  : ""}
              </span>
              {/* The round is stated on every count: this is one guide's vacancies, not a
                  standing description of where the public sector hires. */}
              {targets?.round ? (
                <span
                  className="text-[11px]"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("round_note", { round: targets.round })}
                </span>
              ) : null}

              {postings == null ? (
                <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                  {t("loading_postings")}
                </p>
              ) : postings.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                  {t("no_postings")}
                </p>
              ) : (
                // No nested scroll — the rail (`vision-board-shell`) is the only scroll surface.
                // Inner max-h + mentor-scrollarea stacked a second gutter beside the rail's and
                // produced the "narrow list + triple scrollbar" look.
                <div className="flex w-full min-w-0 flex-col">
                  {postings.map((p) => (
                    <PostingRow key={p.osymCode} posting={p} />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function SearchResults({
  results,
  targetTitleId,
  targetInstitutionId,
  onCity,
  onTitle,
  onInstitution,
}: {
  /** Null while the debounce is still in flight for the current query. */
  results: GeoSearchResultDto | null;
  targetTitleId: string | null;
  targetInstitutionId: string | null;
  onCity: (code: string) => void;
  onTitle: (title: TitleDto) => void;
  onInstitution: (institution: InstitutionDto) => void;
}) {
  const t = useTranslations("vision.kpss");

  if (!results) {
    return (
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("searching")}
      </p>
    );
  }

  const empty =
    results.cities.length === 0 &&
    results.titles.length === 0 &&
    results.institutions.length === 0;

  if (empty) {
    return (
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("search_empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {results.titles.length > 0 ? (
        <Group title={t("group_titles")}>
          {results.titles.map((x) => (
            <Row
              key={x.id}
              title={x.name}
              selected={x.id === targetTitleId}
              onClick={() => onTitle(x)}
            />
          ))}
        </Group>
      ) : null}

      {results.institutions.length > 0 ? (
        <Group title={t("group_institutions")}>
          {results.institutions.map((x) => (
            <Row
              key={x.id}
              title={x.name}
              selected={x.id === targetInstitutionId}
              onClick={() => onInstitution(x)}
            />
          ))}
        </Group>
      ) : null}

      {results.cities.length > 0 ? (
        <Group title={t("group_cities")}>
          {results.cities.map((c) => (
            <Row key={c.code} title={c.name} onClick={() => onCity(c.code)} />
          ))}
        </Group>
      ) : null}
    </div>
  );
}

/**
 * The 52 civil-service titles, collapsed.
 *
 * Open, this list ate the whole rail and pushed the province's vacancies below the fold — the one
 * thing a user actually reads after clicking the map. It is also not a browse surface the way
 * YKS's university list is: that one is scoped to the selected province, while this is a flat
 * catalogue with no context, and the search box above already finds any of its entries faster than
 * scrolling 52 rows.
 *
 * So it stays as the fallback for "I don't know what it's called, show me the options", and gets
 * out of the way otherwise. Native `<details>`: no state, no JS, keyboard and screen readers work
 * for free. The summary carries the current choice, so collapsing never hides what is set.
 */
function TitlePicker({
  titles,
  targetTitleId,
  onSetTitle,
}: {
  titles: TitleDto[];
  targetTitleId: string | null;
  onSetTitle: (title: TitleDto) => void;
}) {
  const t = useTranslations("vision.kpss");
  const selected = titles.find((x) => x.id === targetTitleId) ?? null;

  return (
    <details className="group flex flex-col gap-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-[var(--radius-card)] px-2.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none">
        <span className="flex min-w-0 flex-col">
          <span
            className="text-xs font-bold uppercase"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("group_titles")}
          </span>
          <span
            className="truncate text-sm"
            style={{
              color: selected ? "var(--color-main)" : "var(--color-secondary)",
              fontWeight: selected ? 700 : 400,
            }}
          >
            {selected ? selected.name : t("pick_title_hint")}
          </span>
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          aria-hidden
          className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          style={{ color: "var(--color-secondary)" }}
        />
      </summary>
      {/* Rail scrolls; nesting another overflow here stacked scrollbars with the shell. */}
      <div className="flex w-full min-w-0 flex-col">
        {titles.map((title) => (
          <Row
            key={title.id}
            title={title.name}
            selected={title.id === targetTitleId}
            onClick={() => onSetTitle(title)}
          />
        ))}
      </div>
    </details>
  );
}

/**
 * Vacancy row — the KPSS twin of `ProgramRow`: the job title leads, everything the guide adds
 * about it (institution, headcount, district) stays a quiet secondary line.
 */
function PostingRow({ posting }: { posting: KpssPostingDto }) {
  const t = useTranslations("vision.kpss");
  const meta = [
    posting.institutionName,
    t("quota", { count: posting.quota }),
    posting.district,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius-card)] px-2.5 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)] motion-reduce:transition-none">
      <span
        className="text-sm font-semibold leading-snug"
        style={{ color: "var(--color-main)" }}
      >
        {posting.titleName}
      </span>
      <span className="text-[11px] leading-snug" style={{ color: "var(--color-secondary)" }}>
        {meta}
      </span>
    </div>
  );
}

/**
 * Search result section — heading above rows; the rail scrolls the whole stack.
 */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <span
        className="text-xs font-bold uppercase"
        style={{ color: "var(--color-secondary)" }}
      >
        {title}
      </span>
      <div className="flex w-full min-w-0 flex-col">{children}</div>
    </div>
  );
}

function Row({
  title,
  selected = false,
  onClick,
}: {
  title: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="w-full cursor-pointer rounded-[var(--radius-card)] px-2.5 py-2 text-left text-sm transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
      style={{
        color: selected ? "var(--color-main)" : "var(--color-body)",
        fontWeight: selected ? 700 : 400,
      }}
    >
      {title}
    </button>
  );
}
