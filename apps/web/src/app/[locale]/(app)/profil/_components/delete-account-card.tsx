"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.mjs";
import { ApiClientError, http } from "@mentor/api-client";
import { Button, Card, SectionHeading, TextField } from "@mentor/ui";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";

/**
 * Danger zone — self-service KVKK erasure ("hesabımı sil").
 *
 * Irreversible, so it asks the user to TYPE the confirmation phrase rather than just clicking a
 * dialog: password re-entry would lock out Google-only accounts, and a single click is too easy to
 * hit by accident. The copy spells out what goes (chats, notes, goal board) and what legally stays
 * (invoices), plus that the subscription is cancelled.
 */
export function DeleteAccountCard() {
  const t = useTranslations("profile.delete_account");
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expected = t("confirm_phrase");
  const matches = phrase.trim().toLocaleUpperCase("tr") === expected.toLocaleUpperCase("tr");

  async function submit() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await http<void>("/v1/account", { method: "DELETE" });
      // Server already revoked every session; clear local auth state and leave the app.
      await logout().catch(() => {});
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.body.message
          : err instanceof Error
            ? err.message
            : String(err),
      );
      setBusy(false);
    }
  }

  return (
    <Card solid className="p-4">
      <SectionHeading>{t("title")}</SectionHeading>
      <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("description")}
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{ color: "var(--color-danger)" }}
        >
          <Trash2 className="size-4" aria-hidden />
          {t("cta")}
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--color-body)" }}>
            {t("confirm_hint", { phrase: expected })}
          </p>
          <TextField
            label={t("confirm_label")}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            autoComplete="off"
            disabled={busy}
          />
          {error ? <FormError message={error} /> : null}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={!matches || busy}
              className="flex-1"
            >
              {busy ? t("deleting") : t("confirm_cta")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setPhrase("");
                setError(null);
              }}
              disabled={busy}
              className="flex-1"
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
