"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right.mjs";
import Flame from "lucide-react/dist/esm/icons/flame.mjs";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle.mjs";
import Users from "lucide-react/dist/esm/icons/users.mjs";
import type { CommunitySummary, ForumFeedItem, ForumHubView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { trackCommunityEvent } from "@/lib/analytics";
import { getCommunitySummary } from "@/lib/community";
import { getForumHub, isForumDisabled, joinZone } from "@/lib/forum";
import { AuthorAvatar } from "./author-avatar";
import { GlobalComposer } from "../feed/_components/global-composer";

type HubState =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; hub: ForumHubView; effort: CommunitySummary | null };

export function HubShell() {
  const t = useTranslations("community");
  const locale = useLocale();
  const [state, setState] = useState<HubState>({ status: "loading" });
  const [joiningZone, setJoiningZone] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getForumHub(), getCommunitySummary().catch(() => null)])
      .then(([hub, effort]) => {
        if (!active) return;
        setState({ status: "ready", hub, effort });
        trackCommunityEvent("community_hub_view", { surface: "community" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isForumDisabled(error)) setState({ status: "disabled" });
        else {
          setState({
            status: "error",
            message: error instanceof ApiClientError ? error.body.message : t("error"),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [t]);

  if (state.status === "loading") return <HubSkeleton label={t("loading")} />;
  if (state.status === "disabled") return <Centered title={t("soon_title")} body={t("soon_desc")} />;
  if (state.status === "error") {
    return (
      <Centered title={t("hub_error_title")} body={state.message}>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-xl px-5 font-bold text-white"
          style={{ background: "var(--color-btn)" }}
          onClick={() => window.location.reload()}
        >
          {t("refresh")}
        </button>
      </Centered>
    );
  }

  const { hub, effort } = state;
  const formattedDates = new Map(
    hub.continueDiscussions.map((item) => [
      item.id,
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
        new Date(item.lastActivityAt),
      ),
    ]),
  );
  const communityFaces = Array.from(
    new Map(
      [
        ...(hub.featured ? [hub.featured.author] : []),
        ...hub.supporters,
        ...hub.continueDiscussions.map((item) => item.author),
      ].map((person) => [person.id, person] as const),
    ).values(),
  ).slice(0, 5);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-7 sm:px-7 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.03em] text-[#111318] sm:text-[36px]">
            {t("hub_title")}
          </h1>
        </div>
        <GlobalComposer onCreated={() => window.location.reload()} />
      </header>

      <div className="mt-9 grid gap-5 xl:grid-cols-[minmax(0,1.03fr)_minmax(420px,1fr)]">
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-[16px] bg-[var(--community-blue)] p-7 text-[#111318] sm:p-8" aria-label={t("hub_featured")}>
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-[13px] font-bold text-[#111318]">{t("hub_featured")}</p>
              {hub.featured ? (
                <Link href={{ pathname: "/community/[slug]", params: { slug: hub.featured.zone.slug } }} className="mt-2 inline-flex min-h-11 items-center rounded-full bg-black/10 px-3 text-xs font-bold text-[#111318] hover:bg-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--community-blue-ink)]">
                  {hub.featured.zone.title}
                </Link>
              ) : null}
            </div>
            {communityFaces.length ? (
              <div className="hidden text-right sm:block">
                <div className="flex justify-end -space-x-2" aria-label={t("hub_supporters")}>
                  {communityFaces.map((person) => (
                    <span key={person.id} className="rounded-full ring-2 ring-[var(--community-blue)]">
                      <AuthorAvatar name={person.displayName} src={person.avatarUrl} size={36} />
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-auto max-w-[620px] pt-14">
            {hub.featured ? (
              <>
                <h2 className="max-w-[560px] text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em] text-balance text-[#111318] sm:text-[38px]">
                  {hub.featured.title ?? hub.featured.body.slice(0, 95)}
                </h2>
                {hub.featured.title ? (
                  <p className="mt-4 line-clamp-2 max-w-[65ch] text-[14px] leading-6 text-[#263748]">{hub.featured.body}</p>
                ) : null}
                <div className="mt-5 flex items-center gap-3">
                  <AuthorAvatar name={hub.featured.author.displayName} src={hub.featured.author.avatarUrl} size={32} />
                  <p className="text-xs font-semibold text-[#263748]">{hub.featured.author.displayName} · @{hub.featured.author.username}</p>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] font-semibold text-[#263748]">
                  <span className="flex items-center gap-2"><MessageCircle size={17} aria-hidden />{t("comment_total", { count: hub.featured.commentCount })}</span>
                  <span className="flex items-center gap-2"><Users size={17} aria-hidden />+1 {t("helpful")} · {hub.featured.helpfulVoteCount}</span>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={detailHref(hub.featured)} className="flex min-h-11 items-center justify-center rounded-[10px] bg-white px-5 text-sm font-bold text-[var(--community-blue-ink)] hover:bg-[var(--community-blue-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--community-blue-ink)]">
                    {t("join")}
                  </Link>
                  <Link href={detailHref(hub.featured)} className="flex min-h-11 items-center justify-center rounded-[10px] border border-black/25 px-5 text-sm font-bold text-[#111318] hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--community-blue-ink)]">
                    {t("hub_read_discussion")}
                  </Link>
                </div>
              </>
            ) : (
              <p className="py-10 text-sm text-[#263748]">{t("hub_featured_empty")}</p>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-[16px] border border-[#e4e7ec] bg-white" aria-labelledby="continue-heading">
          <div className="flex min-h-[76px] items-center justify-between gap-3 border-b border-[#eceef2] px-5 py-4">
            <div>
              <h2 id="continue-heading" className="flex items-center gap-2 text-[19px] font-extrabold tracking-[-0.025em] text-[#171a22]">
                <span className="grid size-8 place-items-center rounded-[8px] bg-[var(--community-blue-soft)] text-[var(--community-blue-ink)]" aria-hidden><MessageCircle size={16} /></span>
                {t("hub_continue")}
              </h2>
            </div>
            <Link href="/community/feed" className="rounded-lg px-2 py-2 text-xs font-bold text-[var(--community-blue-ink)] hover:bg-[var(--community-blue-soft)]">{t("see_all")}</Link>
          </div>
          <div className="divide-y divide-[#eceef2]">
            {hub.continueDiscussions.length ? hub.continueDiscussions.slice(0, 4).map((item) => (
              <Link key={item.id} href={detailHref(item)} className="group grid min-h-[82px] grid-cols-[minmax(0,1fr)_44px] items-center gap-4 px-5 py-3 transition-colors hover:bg-[var(--community-blue-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold text-[#20242d]">{item.title ?? item.body}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#7b808a]">
                    <span className={`size-2 rounded-full ${item.zone.type === "QA" ? "bg-[#dc5c49]" : item.zone.type === "ANNOUNCEMENT" ? "bg-[#2f8f63]" : "bg-[var(--community-blue)]"}`} aria-hidden />
                    <span>{item.author.displayName}</span><span aria-hidden>•</span><span>{t("comment_total", { count: item.commentCount })}</span><span aria-hidden>•</span><span>{formattedDates.get(item.id)}</span>
                  </span>
                </span>
                <span className="grid size-10 place-items-center rounded-full bg-[#f1f3f6] text-[#606774] transition-colors group-hover:bg-[var(--community-blue)] group-hover:text-[#111318]"><ArrowUpRight size={17} aria-hidden /></span>
              </Link>
            )) : <EmptyCard>{t("hub_continue_empty")}</EmptyCard>}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-[16px] border border-[#e4e7ec] bg-white p-5 sm:p-6" aria-label={t("hub_trending_tags")}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#eef0f3] pb-5">
          <div>
            <h2 className="flex items-center gap-2 text-[17px] font-extrabold text-[#181b23]">
              <span className="grid size-8 place-items-center rounded-[8px] bg-[#eaf7f0] text-[#2f8f63]" aria-hidden><Flame size={16} /></span>
              {t("hub_effort")}
            </h2>
          </div>
          {effort ? (
            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm">
              <span className="font-bold text-[#2f8f63]">{t("stat_streak_days", { count: effort.streak })}</span>
              <span className="text-[#b3b7bf]" aria-hidden>•</span>
              <span className="font-semibold text-[#555c68]">{effort.xp === null ? t("hub_effort_private") : `${effort.xp} XP`}</span>
              <Link href="/community/leaderboard" className="ml-1 grid size-11 place-items-center rounded-full bg-[var(--community-blue)] text-[#111318] hover:bg-[var(--community-blue-hover)] hover:text-white" aria-label={t("rank_see_all")}><ArrowUpRight size={17} aria-hidden /></Link>
            </div>
          ) : <span className="text-sm text-[#7b808a]">{t("hub_effort_unavailable")}</span>}
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          <HubColumn title={t("hub_trending_tags")}>
            {hub.trendingTags.length ? hub.trendingTags.slice(0, 4).map((tag) => (
              <Link key={tag.id} href={{ pathname: "/community/feed", query: { tag: tag.slug } }} className="group flex min-h-[58px] items-center justify-between px-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
                <span className="flex items-center gap-3 font-semibold text-[#282c35]"><span className="grid size-8 place-items-center rounded-[8px] bg-[var(--community-blue-soft)] font-extrabold text-[var(--community-blue-ink)]">#</span>{tag.name}</span><span className="text-xs text-[#858a94] group-hover:text-[var(--community-blue-ink)]">{tag.threadCount}</span>
              </Link>
            )) : <EmptyLine>{t("hub_tags_empty")}</EmptyLine>}
          </HubColumn>

          <HubColumn title={t("hub_supporters")}>
            {hub.supporters.length ? hub.supporters.slice(0, 4).map((person) => (
              <Link key={person.id} href={{ pathname: "/community/member/[username]", params: { username: person.username } }} className="flex min-h-[58px] items-center gap-3 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
                <AuthorAvatar name={person.displayName} src={person.avatarUrl} size={34} />
                <span className="truncate text-sm font-semibold text-[#282c35]">{person.displayName}</span>
              </Link>
            )) : <EmptyLine>{t("hub_supporters_empty")}</EmptyLine>}
          </HubColumn>

          <HubColumn title={t("hub_rooms")}>
            {hub.recommendedZones.length ? hub.recommendedZones.map((zone) => (
              <div key={zone.id} className="flex min-h-[58px] items-center justify-between gap-3 px-1">
                <Link href={{ pathname: "/community/[slug]", params: { slug: zone.slug } }} className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
                  <span className="flex items-center gap-2 truncate text-sm font-semibold text-[#282c35]"><span className={`size-2 rounded-full ${zone.type === "QA" ? "bg-[#dc5c49]" : zone.type === "ANNOUNCEMENT" ? "bg-[#2f8f63]" : "bg-[var(--community-blue)]"}`} aria-hidden />{zone.title}</span>
                  <span className="text-[11px] text-[#858a94]">{t("members", { count: zone.memberCount })}</span>
                </Link>
                <button type="button" disabled={joiningZone === zone.id} onClick={() => handleJoin(zone.id, setJoiningZone, setState)} className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--community-blue-soft)] text-[var(--community-blue-ink)] hover:bg-[var(--community-blue)] hover:text-[#111318] disabled:opacity-50" aria-label={t("join")}><ArrowUpRight size={16} aria-hidden /></button>
              </div>
            )) : <EmptyLine>{t("hub_rooms_empty")}</EmptyLine>}
          </HubColumn>
        </div>
      </section>
    </main>
  );
}

function HubColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[16px] font-extrabold tracking-[-0.02em] text-[#181b23]">{title}</h2>
      <div className="mt-3 divide-y divide-[#eceef2]">{children}</div>
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[12px] bg-[#fafafa] px-4 py-5 text-sm text-[#7b808a]">{children}</p>;
}

function detailHref(item: ForumFeedItem) {
  return item.zone.type === "QA"
    ? ({ pathname: "/community/question/[threadId]", params: { threadId: item.id } } as const)
    : ({ pathname: "/community/message/[threadId]", params: { threadId: item.id } } as const);
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
          ? { ...current, hub: { ...current.hub, recommendedZones: current.hub.recommendedZones.filter((entry) => entry.id !== zoneId) } }
          : current,
      ),
    )
    .finally(() => setJoiningZone(null));
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-white px-5 py-10 text-center text-sm" style={{ color: "var(--color-secondary)" }}>
      {children}
    </div>
  );
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
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
          {body}
        </p>
        {children}
      </div>
    </main>
  );
}

function HubSkeleton({ label }: { label: string }) {
  return (
    <main className="mx-auto w-full max-w-5xl animate-pulse px-4 py-8" aria-label={label}>
      <div className="h-10 w-64 rounded-xl bg-black/[0.06]" />
      <div className="mt-3 h-5 w-96 max-w-full rounded bg-black/[0.05]" />
      <div className="mt-8 h-72 rounded-2xl bg-black/[0.05]" />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="h-48 rounded-2xl bg-black/[0.05]" />
        <div className="h-48 rounded-2xl bg-black/[0.05]" />
      </div>
    </main>
  );
}
