"use client";

import { useCallback, useId, useMemo, useState, type KeyboardEvent, type RefObject } from "react";
import type { ForumTagView } from "@mentor/types";
import {
  filterHashtagSuggestions,
  getActiveHashtagToken,
  replaceHashtagToken,
  type HashtagToken,
} from "../../_components/composer-hashtags";

/** The composer's "#" autocomplete: the token under the caret, its suggestions and keyboard. */
export function useComposerHashtags({
  tags,
  body,
  setBody,
  bodyRef,
}: {
  tags: ForumTagView[];
  body: string;
  setBody: (value: string) => void;
  bodyRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const listboxId = useId();
  const [token, setToken] = useState<HashtagToken | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(
    () => (token ? filterHashtagSuggestions(tags, token.query) : []),
    [token, tags],
  );

  const sync = (value: string, caret: number) => {
    setToken(getActiveHashtagToken(value, caret));
    setActiveIndex(0);
  };

  const select = (tag: ForumTagView) => {
    if (!token) return;
    const next = replaceHashtagToken(body, token, tag);
    setBody(next.value);
    setToken(null);
    requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  /** Returns true when the key was the autocomplete's to handle. */
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!token) return false;
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length > 0) {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + suggestions.length) % suggestions.length);
      return true;
    }
    if ((event.key === "Enter" || event.key === "Tab") && suggestions.length > 0) {
      if (event.metaKey || event.ctrlKey) return false;
      event.preventDefault();
      select(suggestions[Math.min(activeIndex, suggestions.length - 1)]!);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setToken(null);
      return true;
    }
    return false;
  };

  const activeDescendant =
    suggestions.length > 0 ? `${listboxId}-${Math.min(activeIndex, suggestions.length - 1)}` : undefined;
  // Stable, so the composer's outside-click effect does not re-subscribe on every keystroke.
  const clear = useCallback(() => setToken(null), []);

  return {
    listboxId,
    token,
    clear,
    activeIndex,
    setActiveIndex,
    suggestions,
    activeDescendant,
    sync,
    select,
    onKeyDown,
  };
}
