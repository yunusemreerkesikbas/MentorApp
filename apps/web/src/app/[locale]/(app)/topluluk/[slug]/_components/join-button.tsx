"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ZoneMemberStatus } from "@mentor/types";
import { Button } from "@mentor/ui";
import { joinZone } from "@/lib/forum";

/** Join CTA — hidden once ACTIVE; shows a pending note for REQUEST zones awaiting approval. */
export function JoinButton({
  zoneId,
  myStatus,
  onJoined,
}: {
  zoneId: string;
  myStatus: ZoneMemberStatus | null;
  onJoined: (status: ZoneMemberStatus) => void;
}) {
  const t = useTranslations("topluluk");
  const [busy, setBusy] = useState(false);

  if (myStatus === "ACTIVE") return null;
  if (myStatus === "PENDING") {
    return (
      <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("join_pending")}
      </span>
    );
  }

  return (
    <Button
      variant="secondary"
      busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { status } = await joinZone(zoneId);
          onJoined(status);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? t("joining") : t("join")}
    </Button>
  );
}
