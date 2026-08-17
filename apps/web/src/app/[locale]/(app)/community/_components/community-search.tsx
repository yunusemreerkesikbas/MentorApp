"use client";

import {
  ArrowDown,
  ArrowUp,
  Clock3,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import {
  ZoneType,
  type ForumPublicPerson,
  type ForumSearchView,
  type ForumTagView,
  type ForumThreadSummary,
  type ForumTrendItem,
  type ForumZoneSearchResult,
} from "@mentor/types";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { useRouter } from "@/i18n/navigation";
import {
  addRecentSearch,
  COMMUNITY_SEARCH_HISTORY_KEY,
  normalizeRecentSearches,
} from "@/lib/community-search-history";
import { getForumTrends, searchForum } from "@/lib/forum";
import { AuthorAvatar } from "./author-avatar";

type SearchFilter = "all" | "zones" | "threads" | "questions" | "tags" | "people";
type SearchStatus = "idle" | "loading" | "success" | "error";
type SearchItem =
  | { kind: "zone"; value: ForumZoneSearchResult }
  | { kind: "thread"; value: ForumThreadSummary }
  | { kind: "question"; value: ForumThreadSummary }
  | { kind: "tag"; value: ForumTagView }
  | { kind: "person"; value: ForumPublicPerson };

const EMPTY_RESULTS: ForumSearchView = {
  threads: [],
  questions: [],
  zones: [],
  tags: [],
  people: [],
};

function readRecentSearches(): string[] {
  try {
    const stored = window.localStorage.getItem(COMMUNITY_SEARCH_HISTORY_KEY);
    return normalizeRecentSearches(stored ? JSON.parse(stored) : []);
  } catch {
    return [];
  }
}

function itemKey(item: SearchItem): string {
  return `${item.kind}-${item.value.id}`;
}

export function CommunitySearch() {
  const t = useTranslations("community");
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [results, setResults] = useState<ForumSearchView>(EMPTY_RESULTS);
  const [retryToken, setRetryToken] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trends, setTrends] = useState<ForumTrendItem[]>([]);
  const [trendsLoaded, setTrendsLoaded] = useState(false);
  const [trendsFailed, setTrendsFailed] = useState(false);
  const [trendRetryToken, setTrendRetryToken] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setRecentSearches(readRecentSearches());
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim()) return;
    let current = true;
    getForumTrends("relevant", 5)
      .then((view) => {
        if (current) {
          setTrends(view.items);
          setTrendsLoaded(true);
        }
      })
      .catch(() => {
        if (current) {
          setTrendsFailed(true);
          setTrendsLoaded(true);
        }
      });
    return () => {
      current = false;
    };
  }, [open, query, trendRetryToken]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;

    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(() => {
      searchForum(normalized)
        .then((view) => {
          if (requestId !== requestIdRef.current) return;
          setResults(view);
          setStatus("success");
          setActiveIndex(0);
          setRecentSearches((current) => {
            const next = addRecentSearch(current, normalized);
            window.localStorage.setItem(COMMUNITY_SEARCH_HISTORY_KEY, JSON.stringify(next));
            return next;
          });
        })
        .catch(() => {
          if (requestId === requestIdRef.current) setStatus("error");
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, retryToken]);

  const sections = useMemo(() => {
    const threadItems = results.threads
      .filter((thread) => thread.zoneType !== ZoneType.QA)
      .map((value): SearchItem => ({ kind: "thread", value }));
    const all = [
      { id: "zones" as const, label: t("search_zones"), items: results.zones.map((value): SearchItem => ({ kind: "zone", value })) },
      { id: "threads" as const, label: t("search_threads"), items: threadItems },
      { id: "questions" as const, label: t("search_questions"), items: results.questions.map((value): SearchItem => ({ kind: "question", value })) },
      { id: "tags" as const, label: t("search_tags"), items: results.tags.map((value): SearchItem => ({ kind: "tag", value })) },
      { id: "people" as const, label: t("search_people"), items: results.people.map((value): SearchItem => ({ kind: "person", value })) },
    ];
    return filter === "all" ? all.filter((section) => section.items.length) : all.filter((section) => section.id === filter && section.items.length);
  }, [filter, results, t]);

  const selectableItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);

  useEffect(() => {
    const active = selectableItems[activeIndex];
    if (active) {
      document.getElementById(`community-search-${itemKey(active)}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, selectableItems]);

  function close() {
    setOpen(false);
  }

  function openSearch() {
    setRecentSearches(readRecentSearches());
    setTrendsFailed(false);
    setTrendsLoaded(false);
    setOpen(true);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setActiveIndex(0);
    requestIdRef.current += 1;
    if (value.trim().length < 2) {
      setStatus("idle");
      setResults(EMPTY_RESULTS);
    } else {
      setStatus("loading");
    }
  }

  function finishClose() {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  }

  function handleSelect(item: SearchItem) {
    close();
    if (item.kind === "zone") {
      router.push({ pathname: "/community/[slug]", params: { slug: item.value.slug } });
    } else if (item.kind === "thread") {
      router.push({ pathname: "/community/message/[threadId]", params: { threadId: item.value.id } });
    } else if (item.kind === "question") {
      router.push({ pathname: "/community/question/[threadId]", params: { threadId: item.value.id } });
    } else if (item.kind === "tag") {
      router.push({ pathname: "/community/feed", query: { tag: item.value.slug } });
    } else {
      router.push({ pathname: "/community/member/[username]", params: { username: item.value.username } });
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!selectableItems.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % selectableItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + selectableItems.length) % selectableItems.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const active = selectableItems[activeIndex];
      if (active) handleSelect(active);
    }
  }

  function applyRecentSearch(value: string) {
    updateQuery(value);
    inputRef.current?.focus();
  }

  function clearRecentSearches() {
    window.localStorage.removeItem(COMMUNITY_SEARCH_HISTORY_KEY);
    setRecentSearches([]);
  }

  const filters: Array<{ id: SearchFilter; label: string }> = [
    { id: "all", label: t("search_filter_all") },
    { id: "zones", label: t("search_zones") },
    { id: "threads", label: t("search_threads") },
    { id: "questions", label: t("search_questions") },
    { id: "tags", label: t("search_tags") },
    { id: "people", label: t("search_people") },
  ];
  const hasResults = selectableItems.length > 0;

  return (
    <>
      <motion.button
        type="button"
        className="community-header__search"
        onClick={openSearch}
        aria-haspopup="dialog"
        whileTap={reduceMotion ? undefined : { scale: 0.99 }}
        transition={{ duration: 0.12 }}
      >
        <Search size={18} aria-hidden />
        <span className="community-header__search-placeholder">{t("global_search_placeholder")}</span>
        <kbd className="community-header__search-shortcut">⌘/Ctrl K</kbd>
      </motion.button>

      <dialog
        ref={dialogRef}
        className="community-search-dialog"
        aria-label={t("search_dialog_title")}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setOpen(false)}
      >
        <AnimatePresence onExitComplete={finishClose}>
          {open ? (
            <>
              <motion.div
                key="community-search-scrim"
                className="community-search-dialog__scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: "easeOut" }}
                onClick={close}
                aria-hidden
              />
              <motion.div
                key="community-search-panel"
                className="community-search-panel"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.99 }}
                transition={
                  reduceMotion
                    ? { duration: 0.01 }
                    : { duration: open ? 0.24 : 0.16, ease: [0.22, 1, 0.36, 1] }
                }
              >
          <header className="community-search-panel__header">
            <Search size={21} aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={t("global_search_placeholder")}
              aria-label={t("global_search_placeholder")}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={status === "success" && hasResults}
              aria-controls="community-search-results"
              aria-activedescendant={selectableItems[activeIndex] ? `community-search-${itemKey(selectableItems[activeIndex]!)}` : undefined}
            />
            {query ? (
              <button type="button" className="community-search-panel__icon-button" onClick={() => updateQuery("")} aria-label={t("search_clear_query")}>
                <X size={18} aria-hidden />
              </button>
            ) : null}
          </header>

          <div className="community-search-panel__filters" role="group" aria-label={t("search_filter_label")}>
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                className={filter === item.id ? "is-active" : undefined}
                onClick={() => {
                  setFilter(item.id);
                  setActiveIndex(0);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div
            id="community-search-results"
            className="community-search-panel__body"
            role={status === "success" && hasResults ? "listbox" : undefined}
          >
            {!query.trim() ? (
              <SearchStart
                trends={trends}
                trendsLoaded={trendsLoaded}
                trendsFailed={trendsFailed}
                recentSearches={recentSearches}
                onSearch={applyRecentSearch}
                onClear={clearRecentSearches}
                onRetryTrends={() => {
                  setTrendsFailed(false);
                  setTrendsLoaded(false);
                  setTrendRetryToken((value) => value + 1);
                }}
              />
            ) : query.trim().length < 2 ? (
              <p className="community-search-panel__message">{t("search_min_characters")}</p>
            ) : status === "loading" ? (
              <SearchRowsSkeleton label={t("search_loading")} />
            ) : status === "error" ? (
              <div className="community-search-panel__state">
                <p>{t("search_error")}</p>
                <button type="button" onClick={() => {
                  setStatus("loading");
                  setRetryToken((value) => value + 1);
                }}>{t("search_retry")}</button>
              </div>
            ) : status === "success" && !hasResults ? (
              <div className="community-search-panel__state">
                <strong>{t("search_empty_title")}</strong>
                <p>{t("search_empty_hint")}</p>
              </div>
            ) : (
              sections.map((section) => (
                <section key={section.id} className="community-search-section" aria-labelledby={`community-search-section-${section.id}`}>
                  <h2 id={`community-search-section-${section.id}`}>{section.label}</h2>
                  {section.items.map((item) => {
                    const index = selectableItems.findIndex((candidate) => itemKey(candidate) === itemKey(item));
                    return (
                      <SearchResultRow
                        key={itemKey(item)}
                        item={item}
                        active={index === activeIndex}
                        onSelect={() => handleSelect(item)}
                        onPointerEnter={() => setActiveIndex(index)}
                      />
                    );
                  })}
                </section>
              ))
            )}
          </div>

          <footer className="community-search-panel__footer">
            <span><ArrowUp size={14} /><ArrowDown size={14} /> {t("search_keyboard_move")}</span>
            <span>Enter {t("search_keyboard_open")}</span>
            <span>Esc {t("search_keyboard_close")}</span>
          </footer>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </dialog>
    </>
  );
}

function SearchResultRow({ item, active, onSelect, onPointerEnter }: { item: SearchItem; active: boolean; onSelect: () => void; onPointerEnter: () => void }) {
  const t = useTranslations("community");
  let title: string;
  let detail: string | null = null;
  let label: string;
  let avatar: ForumPublicPerson | null = null;

  if (item.kind === "person") {
    title = item.value.displayName;
    label = `@${item.value.username}`;
    avatar = item.value;
  } else if (item.kind === "zone") {
    title = item.value.title;
    detail = item.value.description;
    label = t(item.value.type === ZoneType.CHAT ? "type_chat" : item.value.type === ZoneType.ANNOUNCEMENT ? "type_announcement" : "type_qa");
  } else if (item.kind === "tag") {
    title = `#${item.value.slug}`;
    label = t("search_tag_label");
  } else {
    title = item.value.title || item.value.bodyExcerpt;
    detail = item.value.title ? item.value.bodyExcerpt : null;
    label = item.value.zoneTitle;
  }

  return (
    <button
      id={`community-search-${itemKey(item)}`}
      type="button"
      role="option"
      aria-selected={active}
      className={`community-search-result${active ? " is-active" : ""}`}
      onClick={onSelect}
      onPointerEnter={onPointerEnter}
    >
      {avatar ? <AuthorAvatar name={avatar.displayName} src={avatar.avatarUrl} size={38} /> : null}
      <span className="community-search-result__content">
        <strong>{title}</strong>
        {detail ? <span>{detail}</span> : null}
      </span>
      <span className="community-search-result__label">{label}</span>
    </button>
  );
}

function SearchStart({ trends, trendsLoaded, trendsFailed, recentSearches, onSearch, onClear, onRetryTrends }: { trends: ForumTrendItem[]; trendsLoaded: boolean; trendsFailed: boolean; recentSearches: string[]; onSearch: (query: string) => void; onClear: () => void; onRetryTrends: () => void }) {
  const t = useTranslations("community");
  return (
    <div className="community-search-start">
      {recentSearches.length ? (
        <section>
          <div className="community-search-start__heading">
            <h2>{t("search_recent")}</h2>
            <button type="button" onClick={onClear}><Trash2 size={15} />{t("search_recent_clear")}</button>
          </div>
          {recentSearches.map((query) => (
            <button key={query.toLocaleLowerCase()} type="button" className="community-search-start__row" onClick={() => onSearch(query)}>
              <Clock3 size={17} aria-hidden /><span>{query}</span>
            </button>
          ))}
        </section>
      ) : null}
      <section>
        <div className="community-search-start__heading"><h2>{t("search_trending")}</h2></div>
        {trendsFailed ? (
          <div className="community-search-panel__state compact"><p>{t("search_trends_error")}</p><button type="button" onClick={onRetryTrends}>{t("search_retry")}</button></div>
        ) : trends.length ? trends.map((trend) => (
          <button key={trend.id} type="button" className="community-search-start__row trend" onClick={() => onSearch(trend.slug)}>
            <span><strong>#{trend.slug}</strong><small>{t("trend_thread_count", { count: trend.threadCount })}</small></span>
          </button>
        )) : trendsLoaded ? (
          <p className="community-search-panel__message">{t("search_trends_empty")}</p>
        ) : <SearchRowsSkeleton label={t("search_loading_trends")} count={3} />}
      </section>
    </div>
  );
}

function SearchRowsSkeleton({ label, count = 5 }: { label: string; count?: number }) {
  return (
    <SkeletonGroup label={label} className="community-search-skeleton">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="community-search-skeleton__row">
          <Skeleton className="h-9 w-9 rounded-full" />
          <span><Skeleton className="h-3 w-36 rounded-full" /><Skeleton className="mt-2 h-2.5 w-52 max-w-full rounded-full" /></span>
        </div>
      ))}
    </SkeletonGroup>
  );
}
