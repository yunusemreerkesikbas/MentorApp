"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { FormError } from "@/components/form";

/**
 * Multi-line composer for a CHAT message / ANNOUNCEMENT (TextField is single-line, so a token-styled
 * textarea). `onSubmit` throws on failure → we surface the backend message (e.g. announcement readonly).
 */
export function ThreadComposer({
  placeholder,
  submitLabel,
  onSubmit,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<void>;
}) {
  const t = useTranslations("topluluk");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const body = value.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(body);
      setValue("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={4000}
        className="w-full resize-y rounded-[var(--radius-card)] border border-white bg-white/70 p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
      />
      <FormError message={error} />
      <div className="flex justify-end">
        <Button busy={busy} onClick={() => void send()}>
          {busy ? t("compose_sending") : submitLabel}
        </Button>
      </div>
    </div>
  );
}
