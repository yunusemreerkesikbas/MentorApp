"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion, useReducedMotion } from "framer-motion";
import type {
  AuthUser,
  ExamCalendarDto,
  InfoArticleSummaryDto,
} from "@mentor/types";
import {
  ApiClientError,
  contentControllerCalendarByFamily,
  usersControllerMe,
} from "@mentor/api-client";
import { Card, Chip, DataCard, SectionHeading } from "@mentor/ui";
import { FormError } from "@/components/form";
import { INFO_ARTICLE_CATEGORY_LABELS } from "@/lib/content-labels";
import { fetchInfoArticlesByFamily } from "@/lib/content-api";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "no_exam_type" }
  | {
      status: "ready";
      examType: string;
      calendar: ExamCalendarDto | null;
      articles: InfoArticleSummaryDto[];
    };

/** Bilgi Merkezi — exam-day data card + editorial article list (guardrail #1). */
export function BilgiShell() {
  const t = useTranslations("knowledge");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(() => {
    usersControllerMe()
      .then(async (meRes) => {
        const me = meRes as unknown as AuthUser;
        if (!me.examType) {
          setState({ status: "no_exam_type" });
          return;
        }
        const [calRes, articlesRes] = await Promise.all([
          contentControllerCalendarByFamily(me.examType),
          fetchInfoArticlesByFamily(me.examType),
        ]);
        const calendar = calRes as unknown as ExamCalendarDto | null;
        setState({
          status: "ready",
          examType: me.examType,
          calendar: calendar?.examDateLabel ? calendar : null,
          articles: articlesRes.items,
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
  }, []);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    loadRef.current();
  }, []);

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" as const },
        },
      };

  const gridMotion = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "show" as const,
        variants: staggerListVariants,
      };

  if (state.status === "loading") {
    return (
      <main className="mx-auto flex min-h-[40vh] w-full max-w-6xl items-center justify-center px-5 py-8">
        <p style={{ color: "var(--color-secondary)" }}>{t("loading")}</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
        <FormError message={state.message} />
        <button
          type="button"
          onClick={() => {
            setState({ status: "loading" });
            loadRef.current();
          }}
          className="mt-4 flex min-h-[44px] items-center rounded-[var(--radius-card)] px-4 text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("retry")}
        </button>
      </main>
    );
  }

  if (state.status === "no_exam_type") {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
        <motion.header className="mb-6" {...headerMotion}>
          <h1
            className="text-2xl font-bold lg:text-3xl"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("title")}
          </h1>
          <p
            className="mt-1 text-base"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("subtitle")}
          </p>
        </motion.header>
        <ExamTypeGate />
      </main>
    );
  }

  const { calendar, articles } = state;
  const examDateEvent = calendar?.events.find((e) => e.type === "EXAM_DATE");
  const verifiedLabel = examDateEvent
    ? new Date(examDateEvent.verifiedAt).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
      <motion.header className="mb-6" {...headerMotion}>
        <h1
          className="text-2xl font-bold lg:text-3xl"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("title")}
        </h1>
        <p
          className="mt-1 text-base"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("subtitle")}
        </p>
      </motion.header>

      <motion.div className="flex flex-col gap-6" {...gridMotion}>
        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          {calendar ? (
            <DataCard
              label={t("exam_day")}
              value={calendar.examDateLabel}
              caption={
                <>
                  <span
                    className="font-semibold"
                    style={{ color: "var(--color-main)" }}
                  >
                    {calendar.exam.name}
                  </span>
                  {calendar.daysRemaining !== null ? (
                    <span className="mt-1 block">
                      {t("days_remaining", { days: calendar.daysRemaining })}
                    </span>
                  ) : null}
                  {verifiedLabel ? (
                    <span
                      className="mt-1 block text-xs"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {t("last_verified")}: {verifiedLabel}
                    </span>
                  ) : null}
                </>
              }
              source={
                examDateEvent
                  ? {
                      label: examDateEvent.source,
                      url: examDateEvent.sourceUrl,
                    }
                  : undefined
              }
            />
          ) : (
            <Card>
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
                  {t("calendar_pending_chip")}
                </span>
                <p
                  className="text-sm"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("calendar_pending_desc")}
                </p>
              </div>
            </Card>
          )}
        </motion.div>

        <motion.section
          variants={reduceMotion ? undefined : staggerItemVariants}
        >
          <SectionHeading subtitle={t("articles_subtitle")}>
            {t("articles_title")}
          </SectionHeading>
          {articles.length === 0 ? (
            <Card className="mt-4">
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <span
                  className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold capitalize"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--color-chip) 30%, transparent)",
                    color: "var(--color-chip-text)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {t("articles_empty_chip")}
                </span>
                <p
                  className="text-base"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("articles_empty_desc")}
                </p>
              </div>
            </Card>
          ) : (
            <motion.ul
              className="mt-4 flex flex-col gap-3"
              initial={reduceMotion ? false : "hidden"}
              animate={reduceMotion ? undefined : "show"}
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.06 } },
              }}
            >
              {articles.map((article) => (
                <motion.li
                  key={article.slug}
                  variants={reduceMotion ? undefined : staggerItemVariants}
                >
                  <Link
                    href={`/bilgi/${article.slug}`}
                    className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
                  >
                    <Card className="transition-opacity hover:opacity-90 motion-reduce:transition-none">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p
                          className="text-base font-semibold"
                          style={{
                            color: "var(--color-main)",
                            fontFamily: "var(--font-heading)",
                          }}
                        >
                          {article.title}
                        </p>
                        <Chip className="shrink-0 px-3 py-1 text-xs">
                          {INFO_ARTICLE_CATEGORY_LABELS[article.category] ??
                            article.category}
                        </Chip>
                      </div>
                      <p
                        className="mt-2 text-sm"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {t("source_label")}: {article.source}
                      </p>
                    </Card>
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </motion.section>

        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <Link
            href="/panel"
            className="flex min-h-[44px] items-center justify-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("back_panel")}
          </Link>
        </motion.div>
      </motion.div>
    </main>
  );
}

function ExamTypeGate() {
  const t = useTranslations("knowledge");

  return (
    <Card>
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
          {t("no_exam_chip")}
        </span>
        <p className="text-base" style={{ color: "var(--color-secondary)" }}>
          {t("no_exam_desc")}
        </p>
        <Link
          href="/profil"
          className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none sm:w-auto"
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
