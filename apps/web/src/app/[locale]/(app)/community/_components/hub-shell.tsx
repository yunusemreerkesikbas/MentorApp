"use client";

import Image from "next/image";
import {
  ArrowUpRight,
  Flame,
  Hash,
  MessageCircle,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ForumFeedItem, ForumHubView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { SkeletonGroup } from "@mentor/ui";

import { Link } from "@/i18n/navigation";
import { trackCommunityEvent } from "@/lib/analytics";
import { getForumHub, isForumDisabled, joinZone } from "@/lib/forum";
import { AuthorAvatar } from "./author-avatar";

type HubState =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; hub: ForumHubView };

export function HubShell() {
  const t = useTranslations("community");
  const locale = useLocale();
  const [state, setState] = useState<HubState>({ status: "loading" });
  const [joiningZone, setJoiningZone] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getForumHub()
      .then((hub) => {
        if (!active) return;
        setState({ status: "ready", hub });
        trackCommunityEvent("community_hub_view", { surface: "community" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isForumDisabled(error)) setState({ status: "disabled" });
        else {
          setState({
            status: "error",
            message:
              error instanceof ApiClientError ? error.body.message : t("error"),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [t]);

  if (state.status === "disabled") {
    return <Centered title={t("soon_title")} body={t("soon_desc")} />;
  }
  if (state.status === "error") {
    return (
      <Centered title={t("hub_error_title")} body={state.message}>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-[10px] bg-[var(--color-btn)] px-5 text-sm font-bold text-[var(--color-btn-label)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          onClick={() => window.location.reload()}
        >
          {t("refresh")}
        </button>
      </Centered>
    );
  }

  const loading = state.status === "loading";
  const hub = state.status === "ready" ? state.hub : null;
  const formattedDates = new Map(
    (hub?.continueDiscussions ?? []).map((item) => [
      item.id,
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
        new Date(item.lastActivityAt),
      ),
    ]),
  );
  const communityFaces = hub
    ? Array.from(
        new Map(
          [
            ...(hub.featured ? [hub.featured.author] : []),
            ...hub.supporters,
            ...hub.continueDiscussions.map((item) => item.author),
          ].map((person) => [person.id, person] as const),
        ).values(),
      ).slice(0, 5)
    : [];

  const readyBody = !hub ? (
    <div className="min-h-[36rem]" aria-hidden />
  ) : (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.03fr)_minmax(380px,1fr)]">
        <section
          className="flex min-h-[480px] flex-col overflow-hidden rounded-[10px] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
          aria-label={t("hub_featured")}
        >
          <div className="relative h-44 overflow-hidden bg-[var(--color-surface)] sm:h-48">
            <Image
              src="/img/feed.png"
              alt={t("hub_featured_image_alt")}
              fill
              priority
              sizes="(min-width: 1280px) 560px, (min-width: 768px) 60vw, 100vw"
              className="object-cover object-center"
            />
            {communityFaces.length ? (
              <div
                className="absolute bottom-3 right-4 hidden -space-x-2 sm:flex"
                aria-label={t("hub_supporters")}
              >
                {communityFaces.map((person) => (
                  <span key={person.id} className="rounded-full ring-2 ring-white">
                    <AuthorAvatar
                      name={person.displayName}
                      src={person.avatarUrl}
                      size={34}
                    />
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-[var(--color-secondary)]">
                {t("hub_featured")}
              </p>
              {hub.featured ? (
                <Link
                  href={{
                    pathname: "/community/[slug]",
                    params: { slug: hub.featured.zone.slug },
                  }}
                  className="inline-flex min-h-11 items-center rounded-[10px] px-3 text-xs font-bold text-[var(--color-chip-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  {hub.featured.zone.title}
                </Link>
              ) : null}
            </div>

            {hub.featured ? (
              <>
                <h2 className="mt-3 max-w-xl text-3xl font-bold leading-tight tracking-[-0.035em] text-balance text-[var(--color-main)]">
                  {hub.featured.title ?? hub.featured.body.slice(0, 95)}
                </h2>
                {hub.featured.title ? (
                  <p className="mt-3 line-clamp-2 max-w-[65ch] text-sm leading-6 text-[var(--color-body-text)]">
                    {hub.featured.body}
                  </p>
                ) : null}

                <div className="mt-4 flex items-center gap-3">
                  <AuthorAvatar
                    name={hub.featured.author.displayName}
                    src={hub.featured.author.avatarUrl}
                    size={32}
                  />
                  <p className="text-xs font-semibold text-[var(--color-body-text)]">
                    {hub.featured.author.displayName}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-[var(--color-secondary)]">
                  <span className="flex items-center gap-2">
                    <MessageCircle size={16} aria-hidden />
                    {t("comment_total", { count: hub.featured.commentCount })}
                  </span>
                  {hub.featured.helpfulVoteCount > 0 ? (
                    <span className="flex items-center gap-2">
                      <Users size={16} aria-hidden />
                      {t("hub_helpful_total", {
                        count: hub.featured.helpfulVoteCount,
                      })}
                    </span>
                  ) : null}
                </div>

                <div className="mt-auto flex flex-col gap-3 pt-5 sm:flex-row">
                  <Link
                    href={detailHref(hub.featured)}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-[10px] bg-[var(--color-btn)] px-5 text-sm font-bold text-[var(--color-btn-label)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  >
                    {t("join")}
                  </Link>
                  <Link
                    href={detailHref(hub.featured)}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-[10px] border border-[var(--color-border)] px-5 text-sm font-bold text-[var(--color-main)] hover:border-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  >
                    {t("hub_read_discussion")}
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col justify-end pt-8">
                <h2 className="text-xl font-bold text-[var(--color-main)]">
                  {t("hub_featured_empty_title")}
                </h2>
                <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[var(--color-secondary)]">
                  {t("hub_featured_empty")}
                </p>
                <Link
                  href="/community/feed"
                  className="mt-5 flex min-h-11 w-fit items-center justify-center rounded-[10px] bg-[var(--color-btn)] px-5 text-sm font-bold text-[var(--color-btn-label)] hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  {t("hub_open_feed")}
                </Link>
              </div>
            )}
          </div>
        </section>

        <section
          className="overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]"
          aria-labelledby="continue-heading"
        >
          <div className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
            <h2
              id="continue-heading"
              className="flex items-center gap-2 text-lg font-bold text-[var(--color-main)]"
            >
              <MessageCircle
                size={19}
                className="text-[var(--community-blue-ink)]"
                aria-hidden
              />
              {t("hub_continue")}
            </h2>
            <Link
              href="/community/feed"
              className="flex min-h-11 items-center px-2 text-xs font-bold text-[var(--community-blue-ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              {t("see_all")}
            </Link>
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            {hub.continueDiscussions.length ? (
              hub.continueDiscussions.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  href={detailHref(item)}
                  className="grid min-h-[68px] grid-cols-[minmax(0,1fr)_32px] items-center gap-2 px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[var(--color-main)]">
                      {item.title ?? item.body}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-secondary)]">
                      <span className={zoneDotClass(item.zone.type)} aria-hidden />
                      <span>{item.author.displayName}</span>
                      <span aria-hidden>•</span>
                      <span>{t("comment_total", { count: item.commentCount })}</span>
                      <span aria-hidden>•</span>
                      <span>{formattedDates.get(item.id)}</span>
                    </span>
                  </span>
                  <ArrowUpRight
                    size={18}
                    className="justify-self-end text-[var(--color-secondary)]"
                    aria-hidden
                  />
                </Link>
              ))
            ) : (
              <EmptyPanel
                icon={<MessageCircle size={20} aria-hidden />}
                body={t("hub_continue_empty")}
                action={t("hub_open_feed")}
              />
            )}
          </div>
        </section>
      </div>

      <section
        className="mt-5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"
        aria-labelledby="effort-board-heading"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-5">
          <div>
            <h2
              id="effort-board-heading"
              className="flex items-center gap-2 text-lg font-bold text-[var(--color-main)]"
            >
              <Flame size={19} className="text-[var(--color-streak)]" aria-hidden />
              {t("hub_effort")}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-secondary)]">
              {t("hub_effort_subtitle")}
            </p>
          </div>
          <Link
            href="/community/feed"
            className="flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm font-bold text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {t("hub_open_feed")}
            <ArrowUpRight size={17} aria-hidden />
          </Link>
        </div>

        <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
          <HubColumn title={t("hub_trending_tags")}>
            {hub.trendingTags.length ? (
              hub.trendingTags.slice(0, 4).map((tag) => (
                <Link
                  key={tag.id}
                  href={{ pathname: "/community/feed", query: { tag: tag.slug } }}
                  className="flex min-h-12 items-center justify-between gap-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-[var(--color-body-text)]">
                    <Hash
                      size={17}
                      className="shrink-0 text-[var(--community-blue-ink)]"
                      aria-hidden
                    />
                    <span className="truncate">{tag.slug}</span>
                  </span>
                  <span className="text-xs text-[var(--color-secondary)]">
                    {tag.threadCount}
                  </span>
                </Link>
              ))
            ) : (
              <EmptyPanel
                icon={<Hash size={20} aria-hidden />}
                body={t("hub_tags_empty")}
                action={t("hub_empty_action")}
              />
            )}
          </HubColumn>

          <HubColumn title={t("hub_supporters")}>
            {hub.supporters.length ? (
              hub.supporters.slice(0, 4).map((person) => (
                <Link
                  key={person.id}
                  href={{
                    pathname: "/community/member/[username]",
                    params: { username: person.username },
                  }}
                  className="flex min-h-12 items-center gap-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <AuthorAvatar
                    name={person.displayName}
                    src={person.avatarUrl}
                    size={32}
                  />
                  <span className="truncate text-sm font-semibold text-[var(--color-body-text)]">
                    {person.displayName}
                  </span>
                </Link>
              ))
            ) : (
              <EmptyPanel
                icon={<Users size={20} aria-hidden />}
                body={t("hub_supporters_empty")}
                action={t("hub_empty_action")}
              />
            )}
          </HubColumn>

          <HubColumn title={t("hub_rooms")}>
            {hub.recommendedZones.length ? (
              hub.recommendedZones.map((zone) => (
                <div
                  key={zone.id}
                  className="flex min-h-12 items-center justify-between gap-3 py-1"
                >
                  <Link
                    href={{
                      pathname: "/community/[slug]",
                      params: { slug: zone.slug },
                    }}
                    className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  >
                    <span className="flex items-center gap-2 truncate text-sm font-semibold text-[var(--color-body-text)]">
                      <span className={zoneDotClass(zone.type)} aria-hidden />
                      {zone.title}
                    </span>
                    <span className="text-xs text-[var(--color-secondary)]">
                      {t("members", { count: zone.memberCount })}
                    </span>
                  </Link>
                  <button
                    type="button"
                    disabled={joiningZone === zone.id}
                    onClick={() => handleJoin(zone.id, setJoiningZone, setState)}
                    aria-label={joiningZone === zone.id ? t("joining") : t("join")}
                    className="group grid size-11 shrink-0 place-items-center rounded-[10px] text-[var(--community-blue-ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  >
                    {joiningZone === zone.id ? (
                      <span aria-hidden>…</span>
                    ) : (
                      <Plus
                        size={17}
                        aria-hidden
                        className="group-hover:stroke-[3] group-focus-visible:stroke-[3]"
                      />
                    )}
                  </button>
                </div>
              ))
            ) : (
              <EmptyPanel
                icon={<Sparkles size={20} aria-hidden />}
                body={t("hub_rooms_empty")}
                action={t("hub_empty_action")}
              />
            )}
          </HubColumn>
        </div>
      </section>
    </>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-7 lg:px-8 lg:py-10">
      <SkeletonGroup label={t("loading")} loading={loading} revealed={readyBody}>
        <HubSkeletonBlocks />
      </SkeletonGroup>
    </main>
  );
}

function HubColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-base font-bold text-[var(--color-main)]">{title}</h3>
      <div className="mt-2 divide-y divide-[var(--color-border)]">{children}</div>
    </section>
  );
}

function EmptyPanel({
  icon,
  body,
  action,
}: {
  icon: React.ReactNode;
  body: string;
  action: string;
}) {
  return (
    <div className="flex min-h-28 items-start gap-3 rounded-[10px] bg-[var(--community-blue-soft)] p-4 text-[var(--color-secondary)]">
      <span className="mt-0.5 shrink-0 text-[var(--community-blue-ink)]">{icon}</span>
      <div>
        <p className="text-sm leading-6 text-[var(--color-body-text)]">{body}</p>
        <Link
          href="/community/feed"
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-[var(--color-main)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          {action}
          <ArrowUpRight size={16} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function zoneDotClass(type: ForumFeedItem["zone"]["type"]) {
  if (type === "QA") return "size-2 shrink-0 rounded-full bg-[var(--community-coral)]";
  if (type === "ANNOUNCEMENT") {
    return "size-2 shrink-0 rounded-full bg-[var(--community-green)]";
  }
  return "size-2 shrink-0 rounded-full bg-[var(--community-blue)]";
}

function detailHref(item: ForumFeedItem) {
  return item.zone.type === "QA"
    ? ({
        pathname: "/community/question/[threadId]",
        params: { threadId: item.id },
      } as const)
    : ({
        pathname: "/community/message/[threadId]",
        params: { threadId: item.id },
      } as const);
}

function handleJoin(
  zoneId: string,
  setJoiningZone: (value: string | null) => void,
  setState: React.Dispatch<React.SetStateAction<HubState>>,
) {
  setJoiningZone(zoneId);
  void joinZone(zoneId)
    .then(() =>
      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              hub: {
                ...current.hub,
                recommendedZones: current.hub.recommendedZones.filter(
                  (entry) => entry.id !== zoneId,
                ),
              },
            }
          : current,
      ),
    )
    .finally(() => setJoiningZone(null));
}

function Centered({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-5">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-[var(--color-main)]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-secondary)]">{body}</p>
        {children}
      </div>
    </main>
  );
}

function HubSkeletonBlocks() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-[480px] rounded-[10px] bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)]" />
        <div className="h-[480px] rounded-[10px] bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)]" />
      </div>
      <div className="h-64 rounded-[10px] bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)]" />
    </div>
  );
}
