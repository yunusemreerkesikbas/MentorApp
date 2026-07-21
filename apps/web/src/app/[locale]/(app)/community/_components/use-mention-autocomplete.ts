"use client";

import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import type { MentionSuggestion } from "@mentor/types";
import { searchZoneMembers } from "@/lib/forum";
import { getActiveMentionToken, type MentionToken } from "./mention-token";

/**
 * @mention autocomplete state for a composer textarea (APP-021). Best-effort by design: no zoneId,
 * no results, or a failed request all mean "no dropdown" — mentions still work typed by hand.
 *
 * Wiring: call `sync` from the textarea's onSelect (fires on typing AND caret moves), gate the
 * composer's own onKeyDown behind `onKeyDown` returning false, and render `MentionSuggestions`
 * with the returned list state. `select` rewrites the textarea value via `onReplace`.
 */
export function useMentionAutocomplete(
  zoneId: string | undefined,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  onReplace: (nextValue: string) => void,
) {
  const listboxId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState<string | null>(null);
  const tokenRef = useRef<MentionToken | null>(null);
  // prefix → results (failures cache as [] so a flaky request can't refetch-loop). A stable Map in
  // state (not a ref — read during render); `version` ticks when it gains an entry.
  const [cache] = useState(() => new Map<string, MentionSuggestion[]>());
  const seqRef = useRef(0);
  const [version, bumpVersion] = useReducer((n: number) => n + 1, 0);

  const suggestions: MentionSuggestion[] = useMemo(() => {
    void version; // the Map is mutable; version invalidates this memo when it gains an entry
    return zoneId && query !== null ? (cache.get(query) ?? []) : [];
  }, [zoneId, query, cache, version]);
  const open = suggestions.length > 0;

  /** Re-derive the active @token from the textarea's current value + caret. */
  const sync = useCallback(() => {
    const el = textareaRef.current;
    const token = el ? getActiveMentionToken(el.value, el.selectionStart ?? 0) : null;
    tokenRef.current = token;
    setQuery(token?.query ?? null);
    setActiveIndex(0);
  }, [textareaRef]);

  const close = useCallback(() => {
    tokenRef.current = null;
    setQuery(null);
  }, []);

  // Debounced, stale-guarded fetch for prefixes not in the cache yet.
  useEffect(() => {
    if (!zoneId || query === null || cache.has(query)) return;
    const seq = ++seqRef.current;
    const timer = setTimeout(() => {
      searchZoneMembers(zoneId, query)
        .then((res) => {
          if (seqRef.current !== seq) return;
          cache.set(query, res);
          bumpVersion();
        })
        .catch(() => {
          if (seqRef.current !== seq) return;
          cache.set(query, []);
          bumpVersion();
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [zoneId, query, cache]);

  const select = useCallback(
    (s: MentionSuggestion) => {
      const el = textareaRef.current;
      const token = tokenRef.current;
      if (!el || !token) return;
      const v = el.value;
      const inserted = `@${s.username} `;
      onReplace(v.slice(0, token.start) + inserted + v.slice(token.end));
      close();
      const caret = token.start + inserted.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    },
    [textareaRef, onReplace, close],
  );

  /** Keyboard handling while the list is open. Returns true when the event was consumed. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!open) return false;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((i) => (i + delta + suggestions.length) % suggestions.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        // Plain Enter picks the suggestion; Ctrl/Cmd+Enter stays the composer's submit shortcut.
        if (e.metaKey || e.ctrlKey) return false;
        e.preventDefault();
        select(suggestions[Math.min(activeIndex, suggestions.length - 1)]!);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return true;
      }
      return false;
    },
    [open, suggestions, activeIndex, select, close],
  );

  /** ARIA combobox attributes for the textarea. */
  const inputProps = {
    role: "combobox" as const,
    "aria-autocomplete": "list" as const,
    "aria-expanded": open,
    "aria-controls": open ? listboxId : undefined,
    "aria-activedescendant": open ? `${listboxId}-${Math.min(activeIndex, suggestions.length - 1)}` : undefined,
  };

  return { open, suggestions, activeIndex, setActiveIndex, select, onKeyDown, sync, close, listboxId, inputProps };
}

export type MentionAutocomplete = ReturnType<typeof useMentionAutocomplete>;
