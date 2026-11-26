import { http } from "@mentor/api-client";
import type { ForumAttachmentUploadUrl } from "@mentor/types";
import type { AttachmentInput } from "@mentor/validation";
import { getApiBaseUrl } from "./env.js";
import { putDevicePhoto, type DevicePhoto } from "./device-photo.js";

/** Storage URLs can be relative (the dev fake endpoint), like the web's `resolveApiUrl`. */
export const attachmentUrl = (url: string) => new URL(url, getApiBaseUrl()).toString();

/** Presigned URL, then the native PUT; the post carries only the returned key. */
export async function uploadForumPhoto(photo: DevicePhoto): Promise<AttachmentInput> {
  const ticket = await http<ForumAttachmentUploadUrl>("/v1/forum/attachments/upload-url", {
    method: "POST", body: JSON.stringify({ contentType: photo.mimeType }),
  });
  if (!(await putDevicePhoto(attachmentUrl(ticket.uploadUrl), photo))) throw new Error("attach_failed");
  return { key: ticket.key, mimeType: photo.mimeType as AttachmentInput["mimeType"], width: photo.width, height: photo.height };
}
