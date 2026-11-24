import { VISION_BOARD_IMAGE_MAX_BYTES, visionBoardDocSchema } from "@mentor/validation";
import { http, getGeoControllerGetGeoUrl, getGeoControllerSearchUrl } from "@mentor/api-client";
import { FORUM_IMAGE_MAX_BYTES, type ExamType, type GeoResponseDto, type GeoSearchResultDto, type VisionBoardDoc, type VisionDto, type VisionBoardImageUploadUrlDto } from "@mentor/types";
import { getApiBaseUrl } from "./env.js";
import { resolveContentMediaUrl } from "./knowledge-view.js";
import type { DevicePhoto } from "./device-photo.js";

export function boardMediaUrl(url: string) {
  return resolveContentMediaUrl(url, getApiBaseUrl());
}

export async function saveBoard(board: VisionBoardDoc) {
  return await http<VisionDto>("/v1/coaching/vision/board", {
    method: "PUT", body: JSON.stringify({ board: visionBoardDocSchema.parse(board) }),
  }) as VisionDto;
}

export async function uploadPicture(photo: DevicePhoto, target: "board" | "forum") {
  const endpoint = target === "board"
    ? "/v1/coaching/vision/board/image-upload-url" : "/v1/forum/attachments/upload-url";
  const blob = await (await fetch(photo.uri)).blob();
  const limit = target === "board" ? VISION_BOARD_IMAGE_MAX_BYTES : FORUM_IMAGE_MAX_BYTES;
  if (blob.size > limit) throw new Error("uploadLarge");
  const ticket = await http<VisionBoardImageUploadUrlDto>(endpoint, {
    method: "POST", body: JSON.stringify({ contentType: photo.mimeType }),
  });
  if (!ticket) throw new Error("failure");
  if (blob.size > ticket.maxBytes) throw new Error("uploadLarge");
  const uploaded = await fetch(boardMediaUrl(ticket.uploadUrl), {
    method: "PUT", headers: { "Content-Type": photo.mimeType }, body: blob,
  });
  if (!uploaded.ok) throw new Error("failure");
  return ticket.key;
}

export async function searchGoalTargets(q: string, examType: ExamType) {
  return await http<GeoSearchResultDto>(getGeoControllerSearchUrl({ q, family: examType })) as GeoSearchResultDto;
}

export async function fetchGoalCities() {
  return await http<GeoResponseDto>(getGeoControllerGetGeoUrl()) as GeoResponseDto;
}
