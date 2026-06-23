"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { Button, TextField } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { postThread } from "@/lib/forum";

/** Ask a question in a QA zone (title + body) → navigate to the new question detail. */
export function AskComposer({ zoneId }: { zoneId: string }) {
  const t = useTranslations("topluluk");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (title.trim().length < 5 || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await postThread(zoneId, body.trim(), title.trim());
      router.push(`/topluluk/soru/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : t("error"));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-white bg-white/50 p-6">
      <TextField
        label={t("ask_title_placeholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("ask_body_placeholder")}
        rows={4}
        maxLength={4000}
        className="w-full resize-y rounded-[var(--radius-card)] border border-white bg-white/70 p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
      />
      <FormError message={error} />
      <div className="flex justify-end">
        <Button busy={busy} onClick={() => void submit()}>
          {t("ask_submit")}
        </Button>
      </div>
    </div>
  );
}
