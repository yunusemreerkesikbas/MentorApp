"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { PhotoAccessDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, Chip, SectionHeading } from "@mentor/ui";
import { FormError } from "@/components/form";
import {
  categorizeMockExamPhoto,
  createPhotoUploadUrl,
  putPhotoToSignedUrl,
} from "@/lib/analiz";

interface PhotoCategorizeCardProps {
  mockExamId: string;
  access: PhotoAccessDto;
  onCategorized?: () => void;
}

/**
 * Premium yanlış-soru foto → ders sınıflandırma (çözüm göstermez §4 #2).
 */
export function PhotoCategorizeCard({
  mockExamId,
  access,
  onCategorized,
}: PhotoCategorizeCardProps) {
  const router = useRouter();
  const translate = useTranslations("photo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chips, setChips] = useState<{ slug: string; name: string }[]>([]);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file || !access.canCategorize) return;
      setError(null);
      setBusy(true);
      try {
        const contentType =
          file.type === "image/png" ? "image/png" : "image/jpeg";
        if (contentType !== file.type && file.type !== "") {
          setError(translate("error_type"));
          return;
        }
        const upload = await createPhotoUploadUrl(contentType);
        if (file.size > upload.maxBytes) {
          setError(translate("error_too_big"));
          return;
        }
        await putPhotoToSignedUrl(upload.uploadUrl, file, contentType);
        const clientRequestId = crypto.randomUUID();
        const result = await categorizeMockExamPhoto(
          mockExamId,
          upload.key,
          clientRequestId,
        );
        setChips(result.subjectRefs);
        onCategorized?.();
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : translate("error_failed"),
        );
      } finally {
        setBusy(false);
      }
    },
    [access.canCategorize, mockExamId, onCategorized, translate],
  );

  if (!access.canCategorize) {
    const isRateLimited = access.reason === "AI_PHOTO_RATE_LIMITED";
    return (
      <Card className="flex flex-col items-start gap-3">
        <Chip>
          {isRateLimited
            ? translate("chip_rate_limited")
            : translate("chip_premium")}
        </Chip>
        <SectionHeading
          as="h2"
          subtitle={
            isRateLimited
              ? translate("locked_rate_limited_subtitle")
              : translate("locked_premium_subtitle")
          }
        >
          {isRateLimited
            ? translate("locked_rate_limited_title")
            : translate("locked_premium_title")}
        </SectionHeading>
        {isRateLimited ? null : (
          <Button onClick={() => router.push("/abonelik")}>
            {translate("upgrade")}
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <SectionHeading
        as="h2"
        subtitle={translate("upload_subtitle")}
      >
        {translate("upload_title")}
      </SectionHeading>
      {access.remainingThisMonth != null && (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {translate("remaining", { count: access.remainingThisMonth })}
        </p>
      )}
      <FormError message={error} />
      <label className="flex flex-col gap-2">
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--color-main)" }}
        >
          {translate("file_label")}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={busy}
          className="text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            void handleFile(file);
          }}
        />
      </label>
      {busy ? (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {translate("analyzing")}
        </p>
      ) : null}
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {translate("result_prefix")}
          </span>
          {chips.map((c) => (
            <Chip key={c.slug}>{c.name}</Chip>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
