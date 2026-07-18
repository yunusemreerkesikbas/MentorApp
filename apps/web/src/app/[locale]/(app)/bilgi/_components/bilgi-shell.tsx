"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import type { ExamCalendarDto, InfoArticleSummaryDto } from "@mentor/types";
import {
  ApiClientError,
  contentControllerCalendarByFamily,
} from "@mentor/api-client";
import { Card, Chip, DataCard, SectionHeading } from "@mentor/ui";
import { FormError } from "@/components/form";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { fetchInfoArticlesByFamily } from "@/lib/content-api";
import { buildExamCalendarIcs } from "@/lib/exam-calendar-export";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import { BilgiContentSkeleton } from "./bilgi-content-skeleton";
import { ExamProcessTimeline } from "./exam-process-timeline";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "no_exam_type" }
  | {
      status: "ready";
      calendar: ExamCalendarDto | null;
      articles: InfoArticleSummaryDto[];
    };

/** Bilgi Merkezi — verified exam calendar + editorial article guidance. */
export function BilgiShell() {
  const t = useTranslations("knowledge");
  const ui = useTranslations("common");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const { status: authStatus, user } = useAuth();
  const examType = user?.examType;
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(() => {
    if (authStatus === "loading") return;
    if (!examType) {
      setState({ status: "no_exam_type" });
      return;
    }

    setState({ status: "loading" });
    Promise.all([
      contentControllerCalendarByFamily(examType),
      fetchInfoArticlesByFamily(examType),
    ])
      .then(([calRes, articlesRes]) => {
        const calendar = calRes as unknown as ExamCalendarDto | null;
        setState({
          status: "ready",
          calendar,
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
  }, [authStatus, examType]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    loadRef.current();
  }, [authStatus, examType]);

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

  if (state.status === "loading") return <BilgiContentSkeleton />;

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
        <FormError message={state.message} />
        <button
          type="button"
          onClick={load}
          className="mt-4 flex min-h-11 items-center rounded-[var(--radius-card)] px-4 text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
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
        <KnowledgeHeader
          title={t("title")}
          subtitle={t("subtitle")}
          motion={headerMotion}
        />
        <ExamTypeGate />
      </main>
    );
  }

  const { calendar, articles } = state;
  const examDateEvent = calendar?.events.find(
    (event) => event.type === "EXAM_DATE",
  );
  const verifiedLabel = examDateEvent
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(examDateEvent.verifiedAt))
    : null;
  const calendarIcs = calendar?.nextEvent
    ? buildExamCalendarIcs(calendar, {
        locale,
        calendarName: t("calendar_name"),
        eventLabels: {
          APPLICATION_START: t("timeline.application_start"),
          APPLICATION_END: t("timeline.application_end"),
          EXAM_DATE: t("timeline.exam_date"),
          RESULT_DATE: t("timeline.result_date"),
        },
        sourcePrefix: t("source_label"),
        lastVerifiedPrefix: t("last_verified_prefix"),
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
      <KnowledgeHeader
        title={t("title")}
        subtitle={t("subtitle")}
        motion={headerMotion}
      />

      <motion.div className="flex flex-col gap-6" {...gridMotion}>
        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          {calendar?.examDateLabel ? (
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
                      {t("last_verified", { date: verifiedLabel })}
                    </span>
                  ) : null}
                </>
              }
              source={
                examDateEvent
                  ? {
                      label: examDateEvent.source,
                      url: examDateEvent.sourceUrl,
                      prefix: ui("source_prefix"),
                    }
                  : undefined
              }
            />
          ) : (
            <Card>
              <EmptyState
                chip={t("calendar_pending_chip")}
                description={t("calendar_pending_desc")}
              />
            </Card>
          )}
          {calendar && calendarIcs ? (
            <a
              href={`data:text/calendar;charset=utf-8,${encodeURIComponent(calendarIcs)}`}
              download={`${calendar.exam.slug}-takvim.ics`}
              className="mt-3 flex min-h-11 items-center justify-center rounded-[var(--radius-card)] px-4 text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {t("calendar_download")}
            </a>
          ) : null}
        </motion.div>

        {calendar ? (
          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <ExamProcessTimeline
              events={calendar.events}
              nextEvent={calendar.nextEvent}
              daysUntilNextEvent={calendar.daysUntilNextEvent}
            />
          </motion.div>
        ) : null}

        <motion.section
          variants={reduceMotion ? undefined : staggerItemVariants}
        >
          <SectionHeading subtitle={t("articles_subtitle")}>
            {t("articles_title")}
          </SectionHeading>
          {articles.length === 0 ? (
            <Card className="mt-4">
              <EmptyState
                chip={t("articles_empty_chip")}
                description={t("articles_empty_desc")}
              />
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
                          {t(`categories.${article.category.toLowerCase()}`)}
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
            className="flex min-h-11 items-center justify-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
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

function KnowledgeHeader({
  title,
  subtitle,
  motion: animation,
}: {
  title: string;
  subtitle: string;
  motion: object;
}) {
  return (
    <motion.header className="mb-6" {...animation}>
      <h1
        className="text-2xl font-bold lg:text-3xl"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {title}
      </h1>
      <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
        {subtitle}
      </p>
    </motion.header>
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
          href="/profil"
          className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none sm:w-auto"
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
