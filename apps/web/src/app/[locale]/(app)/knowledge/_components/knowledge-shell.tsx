"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ExamCalendarDto, ExamType, InfoArticleSummaryDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card } from "@mentor/ui";
import { FormError } from "@/components/form";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  ARTICLE_CATEGORIES,
  type ArticleCategory,
  fetchExamCalendarByFamily,
  fetchFeaturedArticle,
  fetchInfoArticlesByFamily,
} from "@/lib/content-api";
import { ArticleCard } from "./article-card";
import { FamilyFilterBar } from "./family-filter-bar";
import { FeaturedHero } from "./featured-hero";
import { KnowledgeContentSkeleton } from "./knowledge-content-skeleton";
import { KnowledgePagination } from "./knowledge-pagination";
import { KnowledgeSidebar } from "./knowledge-sidebar";
import {
  KNOWLEDGE_ARTICLE_GRID_CLASS,
  KNOWLEDGE_PAGE_CLASS,
  KNOWLEDGE_SPLIT_CLASS,
} from "./knowledge-layout";

const PAGE_SIZE = 12;

function parseCategory(value: string | null): ArticleCategory | null {
  return value && (ARTICLE_CATEGORIES as readonly string[]).includes(value)
    ? (value as ArticleCategory)
    : null;
}

function parsePage(value: string | null): number {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 1 ? page : 1;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "no_exam_type" }
  | {
      status: "ready";
      calendar: ExamCalendarDto | null;
      featured: InfoArticleSummaryDto | null;
      articles: InfoArticleSummaryDto[];
      related: InfoArticleSummaryDto[];
      total: number;
    };

/** Knowledge center — featured editorial feed + sidebar. */
export function KnowledgeShell() {
  const t = useTranslations("knowledge");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: authStatus, user } = useAuth();
  const examType = user?.examType;
  const [family, setFamily] = useState<ExamType | null>(null);
  const category = parseCategory(searchParams.get("category"));
  const page = parsePage(searchParams.get("page"));
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const replaceQuery = useCallback(
    (next: { page?: number; category?: ArticleCategory | null }) => {
      const nextPage = next.page ?? page;
      const nextCategory = next.category === undefined ? category : next.category;
      router.replace({
        pathname: "/knowledge",
        query: {
          ...(nextPage > 1 ? { page: String(nextPage) } : {}),
          ...(nextCategory ? { category: nextCategory } : {}),
        },
      });
    },
    [category, page, router],
  );

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!examType) {
      setFamily(null);
      return;
    }
    setFamily((current) => current ?? examType);
  }, [authStatus, examType]);

  const load = useCallback(() => {
    if (authStatus === "loading") return;
    if (!examType) {
      setState({ status: "no_exam_type" });
      return;
    }
    if (!family) return;

    setState({ status: "loading" });
    Promise.all([
      fetchExamCalendarByFamily(family),
      fetchFeaturedArticle(family),
      fetchInfoArticlesByFamily(family, page, PAGE_SIZE, {
        category: category ?? undefined,
      }),
      fetchInfoArticlesByFamily(family, 1, 4),
    ])
      .then(([calendar, featured, articlesRes, relatedRes]) => {
        const relatedPool = relatedRes.items.filter(
          (article) => article.slug !== featured?.slug,
        );
        const sameCategory = featured
          ? relatedPool.filter((article) => article.category === featured.category)
          : relatedPool;
        setState({
          status: "ready",
          calendar,
          featured,
          articles: articlesRes.items,
          related: (sameCategory.length > 0 ? sameCategory : relatedPool).slice(0, 3),
          total: articlesRes.total,
        });
      })
      .catch((err: unknown) =>
        setState({
          status: "error",
          message:
            err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err),
        }),
      );
  }, [authStatus, examType, family, category, page]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    loadRef.current();
  }, [authStatus, examType, family, category, page]);

  if (state.status === "loading") return <KnowledgeContentSkeleton />;

  if (state.status === "error") {
    return (
      <main className={KNOWLEDGE_PAGE_CLASS}>
        <FormError message={state.message} />
        <button
          type="button"
          onClick={load}
          className="mt-4 flex min-h-11 items-center rounded-[var(--radius-card)] px-4 text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("retry")}
        </button>
      </main>
    );
  }

  if (state.status === "no_exam_type" || !family) {
    return (
      <main className={KNOWLEDGE_PAGE_CLASS}>
        <ExamTypeGate />
      </main>
    );
  }

  return (
    <main className={KNOWLEDGE_PAGE_CLASS}>
      <FamilyFilterBar
        value={family}
        onChange={(next) => {
          setFamily(next);
          replaceQuery({ page: 1 });
        }}
      />

      <div className={`mt-6 ${KNOWLEDGE_SPLIT_CLASS}`}>
        <section>
          {state.featured ? (
            <div className="mb-6">
              <FeaturedHero article={state.featured} />
            </div>
          ) : null}
          {state.articles.length === 0 ? (
            <Card>
              <EmptyState
                chip={t("articles_empty_chip")}
                description={t("articles_empty_desc")}
              />
            </Card>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {state.articles.map((article) => (
                <li key={article.slug}>
                  <ArticleCard article={article} />
                </li>
              ))}
            </ul>
          )}
          <KnowledgePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={state.total}
            onPageChange={(next) => replaceQuery({ page: next })}
          />
        </section>

        <KnowledgeSidebar
          calendar={state.calendar}
          related={state.related}
          selectedCategory={category}
          onSelectCategory={(next) => replaceQuery({ category: next, page: 1 })}
        />
      </div>
    </main>
  );
}

function EmptyState({
  chip,
  description,
}: {
  chip: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <span
        className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold capitalize"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
          fontFamily: "var(--font-body)",
        }}
      >
        {chip}
      </span>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {description}
      </p>
    </div>
  );
}

function ExamTypeGate() {
  const t = useTranslations("knowledge");

  return (
    <Card>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <EmptyState chip={t("no_exam_chip")} description={t("no_exam_desc")} />
        <Link
          href="/settings"
          className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-[var(--color-btn-label)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 sm:w-auto"
          style={{
            backgroundColor: "var(--color-btn)",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
          }}
        >
          {t("no_exam_cta")}
        </Link>
      </div>
    </Card>
  );
}
