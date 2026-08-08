/**
 * Proves a real R2 setup actually works, end to end, without opening the Cloudflare dashboard.
 *
 * For every key prefix the app writes, it presigns an upload, PUTs a few bytes, reads the object
 * back the way the browser will (public prefixes) and the way the server will (`readObject`), then
 * deletes it and confirms it is gone. Every failure prints the setup step that is missing rather
 * than the raw error, because "403" on its own does not tell you whether the token scope, the
 * bucket name or the CORS policy is wrong.
 *
 * Usage: pnpm --filter @mentor/api storage:check
 * Runbook: docs/core/storage-r2.md
 */
import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { R2StorageAdapter } from "../src/shared/adapters/storage/r2-storage.adapter";
import {
  ALL_PREFIXES,
  PRIVATE_PREFIX,
  isPublicKey,
} from "../src/shared/storage/storage-prefixes";

/** A 1x1 GIF — smallest thing that is unambiguously an image to any content sniffing. */
const TEST_BYTES = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);
const TEST_CONTENT_TYPE = "image/gif";

type Check = { label: string; ok: boolean; detail?: string };

function browserOrigin(): string {
  const raw = process.env.CORS_ORIGINS?.split(",")[0]?.trim();
  return raw || process.env.APP_URL || "http://localhost:3000";
}

/**
 * The adapter reads config through Nest's ConfigService. Booting the whole app would drag in the
 * database; this shim is the entire surface it uses.
 */
function adapter(): R2StorageAdapter {
  const config = {
    get: (key: string) => process.env[key],
  } as unknown as ConfigService<Record<string, string | undefined>, true>;
  return new R2StorageAdapter(config);
}

async function checkPrefix(prefix: string, origin: string): Promise<Check[]> {
  const storage = adapter();
  const key = `${prefix}storage-check/${Date.now()}.gif`;
  const checks: Check[] = [];
  const isPublic = isPublicKey(key);

  // 1 — presign. Fails on bad credentials, wrong account id, or an unrouted prefix.
  let uploadUrl: string;
  try {
    const signed = await storage.createUploadUrl({ key, contentType: TEST_CONTENT_TYPE });
    uploadUrl = signed.url;
    checks.push({ label: "presign", ok: true });
  } catch (error) {
    checks.push({
      label: "presign",
      ok: false,
      detail: `${String(error)} — check R2_ACCOUNT_ID / access keys, and that "${prefix}" is listed in storage-prefixes.ts`,
    });
    return checks;
  }

  // 2 — CORS preflight for the upload. This is the check that catches "uploads silently fail in
  // the browser but curl works": presigned URLs still need a bucket CORS policy.
  try {
    const preflight = await fetch(uploadUrl, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    const allow = preflight.headers.get("access-control-allow-origin");
    checks.push({
      label: "upload CORS preflight",
      ok: Boolean(allow),
      detail: allow
        ? undefined
        : `no Access-Control-Allow-Origin for ${origin} — add a CORS policy with PUT + Content-Type to this bucket (infra/r2/cors-*.json)`,
    });
  } catch (error) {
    checks.push({ label: "upload CORS preflight", ok: false, detail: String(error) });
  }

  // 3 — the upload itself.
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": TEST_CONTENT_TYPE },
    body: TEST_BYTES,
  });
  checks.push({
    label: "PUT object",
    ok: put.ok,
    detail: put.ok
      ? undefined
      : `HTTP ${put.status} — token needs Object Read & Write on this bucket, and the bucket name must match R2_${isPublic ? "PUBLIC" : "PRIVATE"}_BUCKET`,
  });
  if (!put.ok) return checks;

  if (isPublic) {
    // 4 — read it the way a browser will, with an Origin header. Without one, R2 returns no
    // CORS headers at all and the check would pass while the app still breaks.
    const publicUrl = storage.getPublicUrl(key);
    const res = await fetch(publicUrl, { headers: { Origin: origin } });
    checks.push({
      label: "public GET",
      ok: res.ok,
      detail: res.ok
        ? undefined
        : `HTTP ${res.status} at ${publicUrl} — enable the bucket's Public Development URL (or custom domain) and check R2_PUBLIC_BASE_URL`,
    });
    const allow = res.headers.get("access-control-allow-origin");
    checks.push({
      label: "public GET CORS",
      ok: Boolean(allow),
      detail: allow
        ? undefined
        : `no Access-Control-Allow-Origin for ${origin} — the vision-board PNG export reads these pixels back from a canvas and will fail without GET in the CORS policy`,
    });
  } else {
    // The private bucket must refuse to produce a public URL at all.
    let threw = false;
    try {
      storage.getPublicUrl(key);
    } catch {
      threw = true;
    }
    checks.push({
      label: "private key has no public URL",
      ok: threw,
      detail: threw ? undefined : "getPublicUrl returned a URL for a private object — this would expose exam photos",
    });
  }

  // 5 — server-side read (the path the Gemini vision pipeline uses).
  const bytes = await storage.readObject(key);
  checks.push({
    label: "readObject",
    ok: bytes != null && bytes.length === TEST_BYTES.length,
    detail: bytes ? undefined : "returned null — token needs read permission on this bucket",
  });

  // 6 — delete, then confirm it is really gone (KVKK erasure depends on this).
  await storage.deleteObject(key);
  const after = await storage.readObject(key);
  checks.push({
    label: "deleteObject",
    ok: after == null,
    detail: after == null ? undefined : "object still readable after delete",
  });

  return checks;
}

async function main(): Promise<void> {
  if (process.env.STORAGE_PROVIDER !== "r2") {
    console.log(
      `STORAGE_PROVIDER is "${process.env.STORAGE_PROVIDER ?? "fake"}". This script verifies a real R2 setup — set STORAGE_PROVIDER=r2 first (docs/core/storage-r2.md).`,
    );
    process.exit(0);
  }

  const origin = browserOrigin();
  console.log(`Checking R2 as a browser on ${origin} would see it.\n`);

  let failed = 0;
  for (const prefix of ALL_PREFIXES) {
    const label = prefix === PRIVATE_PREFIX ? `${prefix} (private)` : `${prefix} (public)`;
    console.log(label);
    const checks = await checkPrefix(prefix, origin);
    for (const check of checks) {
      console.log(`  ${check.ok ? "✅" : "❌"} ${check.label}${check.detail ? ` — ${check.detail}` : ""}`);
      if (!check.ok) failed += 1;
    }
    console.log("");
  }

  if (failed > 0) {
    console.error(`${failed} check(s) failed. See docs/core/storage-r2.md for the matching setup step.`);
    process.exit(1);
  }
  console.log("All prefixes verified — uploads, public reads, CORS, server reads and deletes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
