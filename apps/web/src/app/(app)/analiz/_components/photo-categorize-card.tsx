"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { PhotoAccessDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, Chip, SectionHeading } from "@mentor/ui";
import { FormError } from "../../../../components/form";
import {
  categorizeMockExamPhoto,
  createPhotoUploadUrl,
  putPhotoToSignedUrl,
} from "../../../../lib/analiz";

interface PhotoCategorizeCardProps {
  mockExamId: string;
  access: PhotoAccessDto;
  onCategorized?: () => void;
}

/**
 * Premium yanlış-soru foto → ders sınıflandırma (çözüm göstermez §4 #2).
 */
export function PhotoCategorizeCard({ mockExamId, access, onCategorized }: PhotoCategorizeCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chips, setChips] = useState<{ slug: string; name: string }[]>([]);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file || !access.canCategorize) return;
      setError(null);
      setBusy(true);
      try {
        const contentType = file.type === "image/png" ? "image/png" : "image/jpeg";
        if (contentType !== file.type && file.type !== "") {
          setError("Yalnızca JPEG veya PNG yükleyebilirsin.");
          return;
        }
        const upload = await createPhotoUploadUrl(contentType);
        if (file.size > upload.maxBytes) {
          setError("Fotoğraf çok büyük.");
          return;
        }
        await putPhotoToSignedUrl(upload.uploadUrl, file, contentType);
        const clientRequestId = crypto.randomUUID();
        const result = await categorizeMockExamPhoto(mockExamId, upload.key, clientRequestId);
        setChips(result.subjectRefs);
        onCategorized?.();
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Fotoğraf işlenemedi.",
        );
      } finally {
        setBusy(false);
      }
    },
    [access.canCategorize, mockExamId, onCategorized],
  );

  if (!access.canCategorize) {
    const isRateLimited = access.reason === "AI_PHOTO_RATE_LIMITED";
    return (
      <Card className="flex flex-col items-start gap-3">
        <Chip>{isRateLimited ? "Aylık limit" : "Premium"}</Chip>
        <SectionHeading
          as="h2"
          subtitle={
            isRateLimited
              ? "Bu ay için foto analiz limitine ulaştın. Yeni dönem başladığında tekrar deneyebilirsin."
              : "Yanlış soru fotoğrafını ders bazında sınıflandırmak Premium özelliği."
          }
        >
          {isRateLimited ? "Aylık limit doldu" : "Foto analizi — Premium"}
        </SectionHeading>
        {isRateLimited ? null : (
          <Button onClick={() => router.push("/abonelik")}>Premium&apos;a yükselt</Button>
        )}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <SectionHeading
        as="h2"
        subtitle="Yanlış sorunun fotoğrafını yükle; hangi derse ait olduğunu tahmin ederiz (çözüm yok)."
      >
        Foto ile ders tahmini
      </SectionHeading>
      {access.remainingThisMonth != null && (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          Bu ay kalan analiz: {access.remainingThisMonth}
        </p>
      )}
      <FormError message={error} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
          Soru fotoğrafı (JPEG/PNG)
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
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>Analiz ediliyor…</p>
      ) : null}
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
            Bu soru muhtemelen:
          </span>
          {chips.map((c) => (
            <Chip key={c.slug}>{c.name}</Chip>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
