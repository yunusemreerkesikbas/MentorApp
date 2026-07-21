"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { acceptAnswer } from "@/lib/forum";

/** Asker-only accept action (shown on each answer while the question is OPEN). */
export function AcceptButton({
  threadId,
  postId,
  onAccepted,
}: {
  threadId: string;
  postId: string;
  onAccepted: () => void;
}) {
  const t = useTranslations("community");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await acceptAnswer(threadId, postId);
          onAccepted();
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("accept")}
    </Button>
  );
}
