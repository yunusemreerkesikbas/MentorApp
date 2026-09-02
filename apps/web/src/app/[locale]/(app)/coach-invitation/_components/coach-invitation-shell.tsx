"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MentorshipInvitationPreviewDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, SectionHeading, TextField } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { useMentorToast } from "@/lib/mentor-toast";
import { acceptInvitation, previewInvitation } from "@/lib/mentorship";
import { DataScopeCard } from "../../my-coach/_components/my-coach-shell";

/**
 * Redeeming a coach invite. Two steps on purpose: look the code up, read what you are agreeing to,
 * THEN accept. KVKK consent has to be informed, so the scope list is between the code and the
 * button, not behind a link nobody opens.
 *
 * A `?code=` in the URL only prefills the field. It is never looked up or accepted on load:
 * clicking a link someone sent you is not consent, and it should not fire a request either.
 */
export function CoachInvitationShell() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [preview, setPreview] = useState<MentorshipInvitationPreviewDto | null>(null);
  const [busy, setBusy] = useState(false);

  const showError = useCallback(
    (err: unknown) => {
      toast.error({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    },
    [toast, common],
  );

  const lookUp = useCallback(
    async (raw: string) => {
      const normalized = raw.trim().toUpperCase();
      if (normalized === "") return;
      setBusy(true);
      try {
        setPreview(await previewInvitation(normalized));
      } catch (err) {
        setPreview(null);
        showError(err);
      } finally {
        setBusy(false);
      }
    },
    [showError],
  );

  async function accept() {
    setBusy(true);
    try {
      await acceptInvitation(code.trim().toUpperCase());
      toast.success({ title: t("invitation_accepted") });
      router.replace("/my-coach");
    } catch (err) {
      showError(err);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-6 sm:px-8 lg:py-10">
      <SectionHeading>{t("invitation_title")}</SectionHeading>

      <Card>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void lookUp(code);
          }}
        >
          <TextField
            label={t("invitation_code_label")}
            placeholder={t("invitation_code_placeholder")}
            value={code}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setCode(event.target.value);
              setPreview(null);
            }}
          />
          <div>
            <Button type="submit" busy={busy} disabled={code.trim() === ""}>
              {t("invitation_check")}
            </Button>
          </div>
        </form>
      </Card>

      {preview ? (
        <>
          <Card>
            <p style={{ color: "var(--color-main)" }}>
              {t("invitation_from", { name: preview.coachDisplayName })}
            </p>
          </Card>
          <DataScopeCard scope={preview.dataScope} />
          <div>
            <Button busy={busy} onClick={accept}>
              {t("invitation_accept")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
