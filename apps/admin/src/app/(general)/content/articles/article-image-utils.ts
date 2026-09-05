import apiClient from "@/lib/apiClient";
import type { ArticleImageUploadUrl } from "@/lib/types";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPTED_IMAGES = ACCEPTED_IMAGE_TYPES.join(",");

export const escapeAttribute = (value: string) => value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export const resolveUploadUrl = (url: string) => {
    if (/^https?:\/\//.test(url)) return url;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";
    return new URL(url, apiUrl).toString();
};

export async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
    const objectUrl = URL.createObjectURL(file);
    try {
        return await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = reject;
            image.src = objectUrl;
        });
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

export async function uploadArticleImage(file: File, purpose: "COVER" | "BODY" | "GALLERY") {
    if (file.size > 5 * 1024 * 1024) throw new Error("Görsel en fazla 5 MB olabilir.");
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) throw new Error("Yalnız JPEG, PNG veya WebP yüklenebilir.");
    const { data } = await apiClient.post<ArticleImageUploadUrl>("/admin/content/articles/images/upload-url", { purpose, contentType: file.type });
    const response = await fetch(resolveUploadUrl(data.uploadUrl), { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!response.ok) throw new Error("Görsel yüklenemedi.");
    return data;
}
