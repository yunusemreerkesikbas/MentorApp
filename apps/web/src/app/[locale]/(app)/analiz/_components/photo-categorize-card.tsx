"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Image from "next/image";
import type { PhotoAccessDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, Chip, ProgressBar, SectionHeading } from "@mentor/ui";
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
  const tAnalysis = useTranslations("analysis");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chips, setChips] = useState<{ slug: string; name: string }[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const clearPreview = useCallback(() => {
    setPendingFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }, [previewUrl]);

  const stageFile = useCallback(
    (file: File | null) => {
      clearPreview();
      if (!file) return;
      const contentType = file.type === "image/png" ? "image/png" : "image/jpeg";
      if (contentType !== file.type && file.type !== "") {
        setError(translate("error_type"));
        return;
      }
      setError(null);
      setPendingFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    },
    [clearPreview, translate],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      if (!access.canCategorize) return;
      setError(null);
      setBusy(true);
      try {
        const contentType = file.type === "image/png" ? "image/png" : "image/jpeg";
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
        clearPreview();
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
    [access.canCategorize, mockExamId, onCategorized, translate, clearPreview],
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
      <SectionHeading as="h2" subtitle={translate("upload_subtitle")}>
        {translate("upload_title")}
      </SectionHeading>

      {access.remainingThisMonth != null && access.monthlyLimit != null ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
            {tAnalysis("photo_quota", {
              remaining: access.remainingThisMonth,
              limit: access.monthlyLimit,
            })}
          </p>
          <ProgressBar
            value={
              access.monthlyLimit > 0
                ? Math.round(
                    ((access.monthlyLimit - access.remainingThisMonth) /
                      access.monthlyLimit) *
                      100,
                  )
                : 0
            }
          />
        </div>
      ) : access.remainingThisMonth != null ? (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {translate("remaining", { count: access.remainingThisMonth })}
        </p>
      ) : null}

      <FormError message={error} />

      {!pendingFile ? (
        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            stageFile(e.dataTransfer.files[0] ?? null);
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          style={{
            borderColor: dragOver
              ? "var(--color-progress)"
              : "color-mix(in srgb, var(--color-main) 15%, transparent)",
            background: dragOver
              ? "color-mix(in srgb, var(--color-chip) 12%, white)"
              : "rgba(255,255,255,0.5)",
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
            {translate("file_label")}
          </p>
          <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
            JPEG / PNG
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/*"
            capture="environment"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              stageFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {previewUrl ? (
            <div className="relative mx-auto aspect-[4/3] w-full max-w-xs overflow-hidden rounded-[var(--radius-card)]">
              <Image
                src={previewUrl}
                alt=""
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              busy={busy}
              onClick={() => void uploadFile(pendingFile)}
            >
              {translate("upload_title")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={clearPreview}
            >
              {tAnalysis("history.close")}
            </Button>
          </div>
        </div>
      )}

      {busy && !pendingFile ? (
        <p className="text-sm" role="status" style={{ color: "var(--color-secondary)" }}>
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
