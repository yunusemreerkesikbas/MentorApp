import { http } from "@mentor/api-client";
import type { CreateNotebookInput, NotebookContentsDto, NotebookDto, NotebookImageUploadUrlDto, NotebookOverviewDto, NotebookPageDoc, NotebookPageDto, NotebookSummaryDto, Paginated, UpdateNotebookInput } from "@mentor/types";
import { NOTEBOOK_IMAGE_MAX_BYTES, NOTEBOOK_IMAGE_MIMES } from "@mentor/validation";
import { getApiBaseUrl } from "./env.js";
import { devicePhotoSize, pickDevicePhoto, putDevicePhoto } from "./device-photo.js";

const desk = "/v1/coaching/notebooks";
const mistake = "/v1/coaching/notebook";
const bookPath = (id?: string) => id ? desk + "/" + encodeURIComponent(id) : mistake;
export const listBooks = (page: number) => http<Paginated<NotebookSummaryDto>>(desk + "?page=" + page + "&pageSize=12");
export async function getBook(id?: string): Promise<NotebookSummaryDto> {
  if (id) return http<NotebookDto>(bookPath(id));
  const overview = await http<NotebookOverviewDto>(mistake);
  return { ...overview.notebook, limits: overview.limits };
}
export const createBook = (input: CreateNotebookInput) => http<NotebookDto>(desk, { method: "POST", body: JSON.stringify(input) });
export const updateBook = (id: string, input: UpdateNotebookInput) => http<NotebookDto>(bookPath(id), { method: "PATCH", body: JSON.stringify(input) });
export const getContents = (id?: string) => http<NotebookContentsDto>(bookPath(id) + "/contents");
export const getPage = (page: number, id?: string) => http<NotebookPageDto>(bookPath(id) + "/pages/" + page);
export const putPage = (page: number, doc: NotebookPageDoc, id?: string) => http<NotebookPageDto>(bookPath(id) + "/pages/" + page, { method: "PUT", body: JSON.stringify({ doc }) });
const notebookImageUri = (url: string) => new URL(url, getApiBaseUrl()).toString();

export async function uploadPagePhoto(source: "camera" | "gallery") {
  const photo = await pickDevicePhoto(source);
  if (!photo) return null;
  if (!NOTEBOOK_IMAGE_MIMES.some((mime) => mime === photo.mimeType)) throw new Error("unsupported_image");
  if (devicePhotoSize(photo) > NOTEBOOK_IMAGE_MAX_BYTES) throw new Error("photo_too_large");
  const ticket = await http<NotebookImageUploadUrlDto>(mistake + "/entries/image-upload-url", {
    method: "POST", body: JSON.stringify({ contentType: photo.mimeType, purpose: "page" }),
  });
  if (!(await putDevicePhoto(notebookImageUri(ticket.uploadUrl), photo))) throw new Error("photo_upload_failed");
  return { ...photo, key: ticket.key };
}
