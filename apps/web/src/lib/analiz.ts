import type {
  CategorizePhotoResultDto,
  MockExamDto,
  Paginated,
  PhotoAccessDto,
  PhotoUploadUrlDto,
} from "@mentor/types";
import { http } from "@mentor/api-client";
import { resolveApiUrl } from "./api-base";

export async function fetchMockExamsList(
  page = 1,
  pageSize = 5,
): Promise<Paginated<MockExamDto>> {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return (await http<Paginated<MockExamDto>>(
    `/v1/mock-exams?${qs.toString()}`,
  )) as Paginated<MockExamDto>;
}

export async function fetchMockExamById(id: string): Promise<MockExamDto> {
  return (await http<MockExamDto>(`/v1/mock-exams/${id}`)) as MockExamDto;
}

export async function fetchPhotoAccess(): Promise<PhotoAccessDto> {
  return (await http<PhotoAccessDto>("/v1/coach/photo-access")) as PhotoAccessDto;
}

export async function createPhotoUploadUrl(contentType: "image/jpeg" | "image/png"): Promise<PhotoUploadUrlDto> {
  return (await http<PhotoUploadUrlDto>("/v1/mock-exams/photo-upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType }),
  })) as PhotoUploadUrlDto;
}

export async function categorizeMockExamPhoto(
  mockExamId: string,
  storageKey: string,
  clientRequestId?: string,
): Promise<CategorizePhotoResultDto> {
  return (await http<CategorizePhotoResultDto>(`/v1/mock-exams/${mockExamId}/categorize-photo`, {
    method: "POST",
    body: JSON.stringify({
      storageKey,
      ...(clientRequestId ? { clientRequestId } : {}),
    }),
  })) as CategorizePhotoResultDto;
}

/** Upload file bytes to signed URL (fake R2 or real). */
export async function putPhotoToSignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
): Promise<void> {
  const res = await fetch(resolveApiUrl(uploadUrl), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) {
    throw new Error("Fotoğraf yüklenemedi.");
  }
}
