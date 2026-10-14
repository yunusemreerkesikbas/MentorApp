"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ZoneMemberStatus, ZoneRole, type ZoneMemberView } from "@mentor/types";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
import { SegmentPillControl } from "@/components/segment-pill-control";
import { approveMember, listZoneMembers, removeMember } from "@/lib/forum";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { relativeTime } from "@/lib/relative-time";
import { AuthorAvatar } from "../../../_components/author-avatar";

type Tab = "pending" | "active";

const ROLE_LABEL = { OWNER: "role_owner", MODERATOR: "role_moderator", MEMBER: "role_member" } as const;

/**
 * Owner/mod: join requests and members, as people (name, @handle, photo), never ids. Approve is the
 * row's outline ledge, reject a quiet word; removing a member asks first.
 */
export function MembersCard({ zoneId }: { zoneId: string }) {
  const t = useTranslations("community");
  const locale = useLocale();
  const dialog = useMentorDialog();
  const toast = useMentorToast();
  const [tab, setTab] = useState<Tab>("pending");
  const [members, setMembers] = useState<Record<Tab, ZoneMemberView[]> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      listZoneMembers(zoneId, ZoneMemberStatus.PENDING),
      listZoneMembers(zoneId, ZoneMemberStatus.ACTIVE),
    ])
      .then(([pending, actives]) => active && setMembers({ pending, active: actives }))
      .catch(() => active && setMembers({ pending: [], active: [] }));
    return () => {
      active = false;
    };
  }, [zoneId]);

  /**
   * Runs one member action; the row leaves only when the server agreed. An approved request
   * moves into the members list, so its tab and count are right without a reload.
   */
  const act = async (from: Tab, userId: string, action: () => Promise<void>, approved = false) => {
    setBusyId(userId);
    try {
      await action();
      setMembers((current) => {
        if (!current) return current;
        const moved = current[from].find((m) => m.userId === userId);
        return {
          ...current,
          [from]: current[from].filter((m) => m.userId !== userId),
          ...(approved && moved ? { active: [{ ...moved, status: ZoneMemberStatus.ACTIVE }, ...current.active] } : {}),
        };
      });
    } catch {
      toast.error({ title: t("action_failed") });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (member: ZoneMemberView) => {
    const ok = await dialog.confirm({
      title: t("remove_confirm_title"),
      message: t("remove_confirm", { name: member.displayName || t("unknown_author") }),
      confirmLabel: t("remove"),
      cancelLabel: t("cancel"),
      destructive: true,
    });
    if (ok) await act("active", member.userId, () => removeMember(zoneId, member.userId));
  };

  const list = members?.[tab] ?? [];

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-3`} aria-labelledby="manage-members-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="manage-members-title" className={PANEL_CARD_TITLE}>
          {t("active_tab")}
        </h2>
        <SegmentPillControl
          items={[
            // No counts until the lists arrive: a "· 0" while loading would read as a fact.
            { id: "pending", label: members ? `${t("pending_tab")} · ${members.pending.length}` : t("pending_tab") },
            { id: "active", label: members ? `${t("active_tab")} · ${members.active.length}` : t("active_tab") },
          ]}
          value={tab}
          onChange={(value) => setTab(value as Tab)}
          ariaLabel={t("members_tab_label")}
          idPrefix="manage-members"
        />
      </div>

      {members === null ? (
        <SkeletonGroup label={t("loading")} className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-40 max-w-full rounded-full" />
            </div>
          ))}
        </SkeletonGroup>
      ) : list.length === 0 ? (
        <p className="py-4 text-body-sm font-semibold text-[var(--color-secondary)]">
          {tab === "pending" ? t("no_pending") : t("no_active_members")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-border)]">
          {list.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
              <AuthorAvatar name={m.displayName} src={m.avatarUrl} size={40} />
              {/* At least 10 rem for the name: on a phone the actions drop under it instead of cutting it. */}
              <span className="flex min-w-0 flex-1 basis-40 flex-col">
                <span className="truncate text-body-sm font-extrabold text-[var(--color-main)]">
                  {m.displayName || t("unknown_author")}
                </span>
                <span className="truncate text-caption font-semibold text-[var(--color-secondary)]">
                  {[
                    m.username ? `@${m.username}` : null,
                    tab === "active" ? t(ROLE_LABEL[m.role]) : relativeTime(m.createdAt, locale),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {tab === "pending" ? (
                <span className="ml-auto flex shrink-0 items-center gap-4">
                  <button
                    type="button"
                    disabled={busyId === m.userId}
                    onClick={() => void act("pending", m.userId, () => approveMember(zoneId, m.userId, false))}
                    className={PANEL_QUIET_LINK}
                  >
                    {t("reject")}
                  </button>
                  <Button
                    size="sm"
                    variant="secondary"
                    busy={busyId === m.userId}
                    onClick={() => void act("pending", m.userId, () => approveMember(zoneId, m.userId, true), true)}
                  >
                    {t("approve")}
                  </Button>
                </span>
              ) : m.role !== ZoneRole.OWNER ? (
                <button
                  type="button"
                  disabled={busyId === m.userId}
                  onClick={() => void remove(m)}
                  className={`${PANEL_QUIET_LINK} text-[var(--color-danger)]`}
                >
                  {t("remove")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
