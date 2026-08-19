"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ZoneMemberStatus, ZoneRole, type ZoneMemberView } from "@mentor/types";
import { Button, Card, SectionHeading } from "@mentor/ui";
import { approveMember, listZoneMembers, removeMember } from "@/lib/forum";

type Tab = "pending" | "active";

/** Owner/mod: review pending join requests and manage active members. */
export function PendingMembers({ zoneId }: { zoneId: string }) {
  const t = useTranslations("community");
  const [tab, setTab] = useState<Tab>("pending");
  const [pendingMembers, setPendingMembers] = useState<ZoneMemberView[] | null>(null);
  const [activeMembers, setActiveMembers] = useState<ZoneMemberView[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      listZoneMembers(zoneId, ZoneMemberStatus.PENDING),
      listZoneMembers(zoneId, ZoneMemberStatus.ACTIVE),
    ])
      .then(([pending, actives]) => {
        if (!active) return;
        setPendingMembers(pending);
        setActiveMembers(actives);
      })
      .catch(() => {
        if (!active) return;
        setPendingMembers([]);
        setActiveMembers([]);
      });
    return () => {
      active = false;
    };
  }, [zoneId]);

  const approve = async (userId: string) => {
    setBusyId(userId);
    try {
      await approveMember(zoneId, userId, true);
      setPendingMembers((prev) => prev?.filter((m) => m.userId !== userId) ?? null);
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (userId: string) => {
    setBusyId(userId);
    try {
      await approveMember(zoneId, userId, false);
      setPendingMembers((prev) => prev?.filter((m) => m.userId !== userId) ?? null);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (userId: string) => {
    setBusyId(userId);
    try {
      await removeMember(zoneId, userId);
      setActiveMembers((prev) => prev?.filter((m) => m.userId !== userId) ?? null);
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = pendingMembers?.length ?? 0;
  const activeCount = activeMembers?.length ?? 0;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>{t("manage_title")}</SectionHeading>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["pending", "active"] as const).map((t2) => (
          <button
            key={t2}
            aria-pressed={tab === t2}
            onClick={() => setTab(t2)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              background: tab === t2 ? "color-mix(in srgb, var(--color-chip) 20%, var(--color-surface))" : "color-mix(in srgb, var(--color-main) 5%, transparent)",
              color: tab === t2 ? "var(--color-main)" : "var(--color-secondary)",
              fontWeight: tab === t2 ? 600 : 400,
            }}
          >
            {t2 === "pending" ? t("pending_tab") : t("active_tab")}
            <span className="ml-1.5 text-xs opacity-60">
              ({t2 === "pending" ? pendingCount : activeCount})
            </span>
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === "pending" && (
        <>
          {pendingMembers === null ? null : pendingMembers.length === 0 ? (
            <p style={{ color: "var(--color-secondary)" }}>{t("no_pending")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingMembers.map((m) => (
                <Card key={m.userId}>
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-xs" style={{ color: "var(--color-secondary)" }}>
                      {m.userId.slice(0, 8)}…
                    </code>
                    <div className="flex gap-2">
                      <Button busy={busyId === m.userId} onClick={() => void approve(m.userId)}>
                        {t("approve")}
                      </Button>
                      <Button
                        variant="secondary"
                        busy={busyId === m.userId}
                        onClick={() => void reject(m.userId)}
                      >
                        {t("reject")}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Active members tab */}
      {tab === "active" && (
        <>
          {activeMembers === null ? null : activeMembers.length === 0 ? (
            <p style={{ color: "var(--color-secondary)" }}>{t("no_active_members")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activeMembers.map((m) => (
                <Card key={m.userId}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs" style={{ color: "var(--color-secondary)" }}>
                        {m.userId.slice(0, 8)}…
                      </code>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          background: "color-mix(in srgb, var(--color-chip) 14%, var(--color-surface))",
                          color: "var(--color-secondary)",
                        }}
                      >
                        {m.role}
                      </span>
                    </div>
                    {m.role !== ZoneRole.OWNER && (
                      <Button
                        variant="secondary"
                        busy={busyId === m.userId}
                        onClick={() => void remove(m.userId)}
                      >
                        {t("remove")}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
