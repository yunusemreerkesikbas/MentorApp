import type {
  NotebookEntryDto,
  Paginated,
  NotebookImageUploadUrlDto,
  NotebookOverviewDto,
  NotebookPageDoc,
  NotebookPageDto,
  NotebookPrelabelDto,
} from "@mentor/types";
import {
  NOTEBOOK_IMAGE_MAX_BYTES,
  NOTEBOOK_IMAGE_MIMES,
  type CreateNotebookEntryInput,
  type ListNotebookEntriesQuery,
  type UpdateNotebookEntryInput,
} from "@mentor/validation";
import { http } from "@mentor/api-client";
import { resolveApiUrl } from "./api-base";

/**
 * Mistake notebook ("yanlış defteri") client calls. Same two-step upload as the board and forum —
 * the API mints a presigned URL and the bytes go straight to storage, never through the API.
 */

export type NotebookImageMime = (typeof NOTEBOOK_IMAGE_MIMES)[number];

export function isSupportedNotebookImage(
  file: File,
): file is File & { type: NotebookImageMime } {
  return (NOTEBOOK_IMAGE_MIMES as readonly string[]).includes(file.type);
}

export function isWithinNotebookImageLimit(file: File): boolean {
  return file.size <= NOTEBOOK_IMAGE_MAX_BYTES;
}

export async function fetchNotebookOverview(): Promise<NotebookOverviewDto> {
  return (await http<NotebookOverviewDto>(
    "/v1/coaching/notebook",
  )) as NotebookOverviewDto;
}

export async function fetchNotebookPage(index: number): Promise<NotebookPageDto> {
  return (await http<NotebookPageDto>(
    `/v1/coaching/notebook/pages/${index}`,
  )) as NotebookPageDto;
}

export async function saveNotebookPage(
  index: number,
  doc: NotebookPageDoc,
): Promise<NotebookPageDto> {
  return (await http<NotebookPageDto>(`/v1/coaching/notebook/pages/${index}`, {
    method: "PUT",
    body: JSON.stringify({ doc }),
  })) as NotebookPageDto;
}

export async function fetchDueEntries(): Promise<NotebookEntryDto[]> {
  return (await http<NotebookEntryDto[]>(
    "/v1/coaching/notebook/reviews/due",
  )) as NotebookEntryDto[];
}

/**
 * The notebook's index. Neither the pages nor the due list can reach an entry that is not arranged
 * on a page and not scheduled for today; this is the read that always can.
 */
export async function fetchNotebookEntries(
  query: ListNotebookEntriesQuery,
): Promise<Paginated<NotebookEntryDto>> {
  const qs = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.subjectRef) qs.set("subjectRef", query.subjectRef);
  if (query.errorType) qs.set("errorType", query.errorType);
  if (query.status) qs.set("status", query.status);
  return (await http<Paginated<NotebookEntryDto>>(
    `/v1/coaching/notebook/entries?${qs.toString()}`,
  )) as Paginated<NotebookEntryDto>;
}

export async function createNotebookEntry(
  input: CreateNotebookEntryInput,
): Promise<NotebookEntryDto> {
  return (await http<NotebookEntryDto>("/v1/coaching/notebook/entries", {
    method: "POST",
    body: JSON.stringify(input),
  })) as NotebookEntryDto;
}

export async function updateNotebookEntry(
  id: string,
  patch: UpdateNotebookEntryInput,
): Promise<NotebookEntryDto> {
  return (await http<NotebookEntryDto>(`/v1/coaching/notebook/entries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })) as NotebookEntryDto;
}

/**
 * Record the forum thread this mistake was asked in.
 *
 * The thread is created through the forum's own flow, not from here: which zone a question belongs
 * in depends on what the user has joined, and picking one on their behalf would be a guess. The
 * notebook hands the question over and stores the id it gets back.
 */
export async function linkNotebookThread(
  id: string,
  threadId: string,
): Promise<NotebookEntryDto> {
  return (await http<NotebookEntryDto>(
    `/v1/coaching/notebook/entries/${id}/community-thread`,
    { method: "POST", body: JSON.stringify({ threadId }) },
  )) as NotebookEntryDto;
}

/** "Could you do it this time?" — the interval ladder lives on the server. */
export async function reviewNotebookEntry(
  id: string,
  solved: boolean,
): Promise<NotebookEntryDto> {
  return (await http<NotebookEntryDto>(
    `/v1/coaching/notebook/entries/${id}/review`,
    { method: "POST", body: JSON.stringify({ solved }) },
  )) as NotebookEntryDto;
}

export async function deleteNotebookEntry(id: string): Promise<void> {
  await http(`/v1/coaching/notebook/entries/${id}`, { method: "DELETE" });
}

/**
 * Premium: ask vision for a subject/topic suggestion on an uploaded photo.
 *
 * Callers treat a rejection as "no suggestion", never as an error — a free user, an exhausted
 * quota and a model that could not tell all mean the same thing here: the student labels it
 * themselves, which is the path that always works.
 */
export async function prelabelNotebookPhoto(
  storageKey: string,
  examId: string,
): Promise<NotebookPrelabelDto | null> {
  try {
    return (await http<NotebookPrelabelDto>(
      "/v1/coaching/notebook/entries/prelabel",
      { method: "POST", body: JSON.stringify({ storageKey, examId }) },
    )) as NotebookPrelabelDto;
  } catch {
    return null;
  }
}

export interface UploadedNotebookImage {
  key: string;
  url: string;
}

export async function uploadNotebookImage(
  file: File,
): Promise<UploadedNotebookImage> {
  const contentType = file.type as NotebookImageMime;
  const { uploadUrl, key } = (await http<NotebookImageUploadUrlDto>(
    "/v1/coaching/notebook/entries/image-upload-url",
    { method: "POST", body: JSON.stringify({ contentType }) },
  )) as NotebookImageUploadUrlDto;

  const res = await fetch(resolveApiUrl(uploadUrl), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) throw new Error("notebook_image_upload_failed");

  // A local blob URL: renders instantly with no round-trip. The server hands back the real URL on
  // the next read — the entry stores only the key either way.
  return { key, url: URL.createObjectURL(file) };
}
