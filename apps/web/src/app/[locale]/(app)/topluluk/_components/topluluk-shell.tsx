"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ThreadView, ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, SectionHeading, TextField } from "@mentor/ui";
import { FormError } from "@/components/form";
import { isForumDisabled, listZones, searchQuestions } from "@/lib/forum";
import { QuestionListItem } from "../[slug]/_components/question-list-item";
import { ZoneCard } from "./zone-card";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; zones: ZoneView[] };

/** Zone types in display order; each becomes a labelled group. */
const GROUPS = [
  { type: "ANNOUNCEMENT", key: "group_announcement" },
  { type: "CHAT", key: "group_chat" },
  { type: "QA", key: "group_qa" },
] as const;

export function ToplulukShell() {
  const t = useTranslations("topluluk");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    listZones()
      .then((res) => {
        if (active) setState({ status: "ready", zones: res.items });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isForumDisabled(err)) {
          setState({ status: "disabled" });
          return;
        }
        setState({
          status: "error",
          message: err instanceof ApiClientError ? err.body.message : t("error"),
        });
      });
    return () => {
      active = false;
    };
  }, [t]);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
      <header className="mb-6">
        <h1
          className="text-2xl font-bold lg:text-3xl"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("title")}
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          {t("subtitle")}
        </p>
      </header>

      {state.status === "loading" ? (
        <p style={{ color: "var(--color-secondary)" }}>{t("loading")}</p>
      ) : state.status === "disabled" ? (
        <EmptyState title={t("soon_title")} desc={t("soon_desc")} />
      ) : state.status === "error" ? (
        <FormError message={state.message} />
      ) : (
        <ReadyContent zones={state.zones} />
      )}
    </main>
  );
}

/** Ready state: a QA search bar + the grouped zone list (or search results when a query is active). */
function ReadyContent({ zones }: { zones: ZoneView[] }) {
  const t = useTranslations("topluluk");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ThreadView[] | null>(null);
  const [searching, setSearching] = useState(false);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const res = await searchQuestions(q);
      setResults(res.items);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const clear = () => {
    setQuery("");
    setResults(null);
  };

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
        className="flex items-end gap-2"
      >
        <div className="flex-1">
          <TextField
            label={t("search_placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" busy={searching}>
          {t("search_submit")}
        </Button>
        {results !== null ? (
          <Button type="button" variant="secondary" onClick={clear}>
            {t("report_cancel")}
          </Button>
        ) : null}
      </form>

      {results !== null ? (
        results.length === 0 ? (
          <p style={{ color: "var(--color-secondary)" }}>{t("search_no_results")}</p>
        ) : (
          <section className="flex flex-col gap-4">
            <SectionHeading>{t("search_results")}</SectionHeading>
            <div className="flex flex-col gap-4">
              {results.map((q) => (
                <QuestionListItem key={q.id} question={q} />
              ))}
            </div>
          </section>
        )
      ) : zones.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        GROUPS.map(({ type, key }) => {
          const groupZones = zones.filter((z) => z.type === type);
          if (groupZones.length === 0) return null;
          return (
            <section key={type} className="flex flex-col gap-4">
              <SectionHeading>{t(key)}</SectionHeading>
              <div className="flex flex-col gap-4">
                {groupZones.map((z) => (
                  <ZoneCard key={z.id} zone={z} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-white bg-white/50 px-6 py-12 text-center">
      <p className="text-lg font-semibold" style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}>
        {title}
      </p>
      {desc ? (
        <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
          {desc}
        </p>
      ) : null}
    </div>
  );
}
