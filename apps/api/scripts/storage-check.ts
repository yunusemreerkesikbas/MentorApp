/**
 * Proves a real R2 setup actually works, end to end, without opening the Cloudflare dashboard.
 *
 * For every key prefix the app writes, it writes a small object through the server adapter, reads it
 * back the way the browser will and the way the server will (`readObject`), then
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

  // 1 — server-side write. Browser uploads terminate at the authenticated API capability endpoint.
  try {
    await storage.putObject(key, TEST_BYTES, TEST_CONTENT_TYPE);
    checks.push({ label: "server PUT object", ok: true });
  } catch (error) {
    checks.push({
      label: "server PUT object",
      ok: false,
      detail: `${String(error)} — check R2_ACCOUNT_ID / access keys, and that "${prefix}" is listed in storage-prefixes.ts`,
    });
    return checks;
  }

  // 2 — browser read. Private media uses a five-minute signed URL after owner authorization.
  if (isPublic) {
    // Read it the way a browser will, with an Origin header. Without one, R2 returns no
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
    const signedUrl = await storage.createReadUrl(key, 300);
    const signed = await fetch(signedUrl, { headers: { Origin: origin } });
    const allow = signed.headers.get("access-control-allow-origin");
    checks.push({
      label: "private signed GET",
      ok: signed.ok && Boolean(allow),
      detail: !signed.ok
        ? `HTTP ${signed.status} — check private bucket read permission and GET CORS`
        : allow ? undefined : `no Access-Control-Allow-Origin for ${origin}`,
    });
  }

  // 3 — server-side read (the path the Gemini vision pipeline uses).
  const bytes = await storage.readObject(key);
  checks.push({
    label: "readObject",
    ok: bytes != null && bytes.length === TEST_BYTES.length,
    detail: bytes ? undefined : "returned null — token needs read permission on this bucket",
  });

  // 4 — delete, then confirm it is really gone (KVKK erasure depends on this).
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
  console.log("All prefixes verified — server writes, authorized browser reads, CORS, server reads and deletes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
