"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ZoneMemberStatus, type ZoneMemberView } from "@mentor/types";
import { Button, Card, SectionHeading } from "@mentor/ui";
import { approveMember, listZoneMembers } from "@/lib/forum";

/** Owner/mod: review + approve/reject pending join requests. */
export function PendingMembers({ zoneId }: { zoneId: string }) {
  const t = useTranslations("topluluk");
  const [members, setMembers] = useState<ZoneMemberView[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listZoneMembers(zoneId, ZoneMemberStatus.PENDING)
      .then((rows) => active && setMembers(rows))
      .catch(() => active && setMembers([]));
    return () => {
      active = false;
    };
  }, [zoneId]);

  // Only "approve" persists server-side today (reject/removal needs a backend endpoint — deferred),
  // so we expose Approve only rather than a misleading no-op Reject.
  const approve = async (userId: string) => {
    setBusyId(userId);
    try {
      await approveMember(zoneId, userId, true);
      setMembers((prev) => prev?.filter((m) => m.userId !== userId) ?? null);
    } finally {
      setBusyId(null);
    }
  };

  if (members === null) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>{t("pending_title")}</SectionHeading>
      {members.length === 0 ? (
        <p style={{ color: "var(--color-secondary)" }}>{t("no_pending")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {members.map((m) => (
            <Card key={m.userId}>
              <div className="flex items-center justify-between gap-3">
                <code className="text-xs" style={{ color: "var(--color-secondary)" }}>
                  {m.userId.slice(0, 8)}…
                </code>
                <Button busy={busyId === m.userId} onClick={() => void approve(m.userId)}>
                  {t("approve")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
