"use client";

import { useEffect, useState } from "react";
import type {
  CityPostingCountDto,
  KpssPostingDto,
  KpssTargetsDto,
} from "@mentor/types";
import {
  geoControllerGetKpssCityCounts,
  geoControllerGetKpssCityPostings,
  geoControllerGetKpssTargets,
} from "@mentor/api-client";

function unwrap<T>(res: unknown): T | null {
  return ((res as { data?: T | null })?.data ?? (res as T | null)) as T | null;
}

/**
 * KPSS reference data for the goal board.
 *
 * Loaded only when the signed-in user actually sits a KPSS exam — a YKS student would be paying
 * for ~18KB of civil-service titles they will never open, which is the same reason `/geo` and
 * `/kpss-targets` are separate endpoints in the first place.
 */
export function useKpssTargets(enabled: boolean) {
  const [targets, setTargets] = useState<KpssTargetsDto | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void geoControllerGetKpssTargets()
      .then((res) => {
        if (!active) return;
        setTargets(unwrap<KpssTargetsDto>(res));
      })
      // A missing round is a supported state — the title list alone still lets a goal be set.
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return { targets, loaded };
}

/** Matches the search box, so one word is one request. */
const COUNTS_DEBOUNCE_MS = 250;

/**
 * Province vacancy counts narrowed to the chosen title, or to what is being typed — the KPSS half
 * of "the map answers the question on screen".
 *
 * Two filters, one hook, because they are the same question asked twice: a chosen title asks
 * "where is my target hired?", a search term asks "where is this hired?". Whichever is active, the
 * pin counts must mean that — a map still showing every vacancy while MÜHENDİS is set is just a
 * wrong number in a large font.
 *
 * The counts are recomputed server-side rather than derived from the search results: a hit list is
 * capped at 10 titles, so filtering pins by it would quietly drop provinces whose only matching
 * vacancy fell off the end of the list.
 *
 * With no filter active the hook returns `null`, which the caller reads as "show everything" and
 * falls back to the unfiltered counts already in `/kpss-targets` — so the map never blanks out
 * between keystrokes.
 */
export function useCityCountsForQuery(
  query: string,
  titleId: string | null,
  enabled: boolean,
) {
  const [byFilter, setByFilter] = useState<{
    key: string;
    counts: CityPostingCountDto[];
  } | null>(null);

  const trimmed = query.trim();
  // A chosen title outranks a half-typed word: the goal is the standing question, the box is a
  // passing one. The server applies the same precedence.
  const active = enabled && Boolean(titleId || trimmed.length >= 2);
  const key = `${titleId ?? ""}|${titleId ? "" : trimmed}`;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void geoControllerGetKpssCityCounts(
        titleId ? { titleId } : { q: trimmed },
        { signal: controller.signal },
      )
        .then((res) =>
          setByFilter({ key, counts: unwrap<CityPostingCountDto[]>(res) ?? [] }),
        )
        // Aborted keystrokes land here too; the stale guard below covers the rest.
        .catch(() => undefined);
    }, COUNTS_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key, trimmed, titleId, active]);

  if (!active) return null;
  // Counts are kept WITH the filter they answer, so deleting "konya" → "ka" never shows the old
  // term's provinces while the new request is still in flight.
  return byFilter && byFilter.key === key ? byFilter.counts : null;
}

/**
 * The vacancies advertised in one province, fetched when a city is opened.
 *
 * Kept out of `/kpss-targets` deliberately: 1.1k rows nobody has asked for is a worse trade than
 * one small request at the moment a province is actually selected.
 */
export function useCityPostings(cityCode: string | null, enabled: boolean) {
  const [byCity, setByCity] = useState<{
    cityCode: string;
    postings: KpssPostingDto[];
  } | null>(null);

  useEffect(() => {
    if (!enabled || !cityCode) return;
    const controller = new AbortController();
    void geoControllerGetKpssCityPostings(cityCode, { signal: controller.signal })
      .then((res) =>
        setByCity({ cityCode, postings: unwrap<KpssPostingDto[]>(res) ?? [] }),
      )
      // Aborted province switches land here too; the stale guard below covers the rest.
      .catch(() => undefined);
    return () => controller.abort();
  }, [cityCode, enabled]);

  // Results are kept WITH the province they answer, so switching city never shows the previous
  // one's vacancies while the new request is still in flight.
  return byCity && byCity.cityCode === cityCode ? byCity.postings : null;
}
