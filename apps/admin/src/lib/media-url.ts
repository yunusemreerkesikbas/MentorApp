/** API-relative fake storage must load from the API origin, not the admin host. */
export function resolveMediaUrl(url: string): string {
    if (/^https?:\/\//.test(url)) return url;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";
    return new URL(url, apiUrl).toString();
}
