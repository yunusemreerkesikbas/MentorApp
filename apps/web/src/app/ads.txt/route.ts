// Environment-backed public metadata, independent of locale and visitor identity.
export const dynamic = "force-dynamic";

export function GET(): Response {
  const publisherId = process.env.GOOGLE_ADS_PUBLISHER_ID?.trim();
  if (!publisherId) return new Response("Not configured\n", { status: 404 });
  if (!/^pub-\d{16}$/.test(publisherId)) throw new Error("Invalid GOOGLE_ADS_PUBLISHER_ID");
  return new Response(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
