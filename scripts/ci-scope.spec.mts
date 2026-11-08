import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { selectCiScope } from "./ci-scope.mts";

test("documentation and marketing do not build applications", () => {
  const scope = selectCiScope(["AGENTS.md", "docs/features/identity.md", "marketing/social/src/Root.tsx", "design/login.png"]);
  assert.equal(scope.code, false);
  assert.equal(scope.full, false);
  assert.equal(scope.filters, "");
});

test("web changes include their workspace dependencies without backend tests", () => {
  const scope = selectCiScope(["apps/web/src/components/card.tsx"]);
  assert.equal(scope.web, true);
  assert.equal(scope.api, false);
  assert.equal(scope.admin, false);
  assert.equal(scope.full, false);
  assert.equal(scope.filters, "--filter=@mentor/web...");
});

test("the shared UI affects web, while admin stays independent", () => {
  assert.equal(selectCiScope(["packages/ui/src/components/logo.tsx"]).filters, "--filter=@mentor/web...");
  const admin = selectCiScope(["apps/admin/src/components/sidebar.tsx"]);
  assert.equal(admin.filters, "--filter=@mentor/admin...");
  assert.equal(admin.web, false);
});

test("ordinary backend changes stay in backend coverage", () => {
  const scope = selectCiScope(["apps/api/src/modules/coaching/plan.service.ts"]);
  assert.equal(scope.api, true);
  assert.equal(scope.web, false);
  assert.equal(scope.admin, false);
  assert.equal(scope.full, false);
});

for (const path of [
  "apps/api/src/modules/identity/auth.service.ts",
  "apps/api/src/modules/payments/webhook.ts",
  "apps/api/src/modules/economy/ledger.ts",
  "apps/api/src/modules/promotions/policy.ts",
  "apps/api/src/database/schema.ts",
  "apps/api/drizzle/0143_change.sql",
  "apps/api/src/common/guards/auth.guard.ts",
  "apps/api/src/shared/ports/storage.port.ts",
  "apps/web/src/app/[locale]/(auth)/login/page.tsx",
  "apps/web/src/app/[locale]/(app)/subscription/page.tsx",
  "apps/web/src/lib/auth-context.tsx",
  "apps/web/src/proxy.ts",
  "packages/types/src/auth.ts",
  "packages/validation/src/auth.ts",
  "packages/core/src/rewards.ts",
  "packages/api-client/src/generated.ts",
  "packages/config/tsconfig/base.json",
  "pnpm-lock.yaml",
  "package.json",
  ".github/workflows/ci.yml",
  "scripts/ci-scope.mts",
  "apps/web/e2e/browser-security.spec.ts",
  "future-app/server.ts",
]) {
  test(`sensitive or unknown path requests full validation: ${path}`, () => {
    const scope = selectCiScope([path]);
    assert.equal(scope.full, true);
    assert.equal(scope.code, true);
    assert.equal(scope.api && scope.web && scope.admin, true);
    assert.equal(scope.filters, "");
  });
}

test("mixed changes keep every affected application", () => {
  const scope = selectCiScope(["apps/admin/src/table.tsx", "apps/web/src/card.tsx", "README.md"]);
  assert.equal(scope.full, false);
  assert.equal(scope.web && scope.admin, true);
  assert.equal(scope.api, false);
});

test("deleted or renamed code paths still participate in classification", () => {
  assert.equal(selectCiScope(["apps/api/src/modules/identity/removed.ts", "docs/removed.md"]).full, true);
});

test("manual full validation includes everything even with no changed files", () => {
  assert.equal(selectCiScope([], true).full, true);
  assert.equal(selectCiScope([]).code, false);
});

test("unusual file names cannot turn scope outputs into shell arguments", () => {
  const scope = selectCiScope(["apps/web/src/name\nfilters=--danger.tsx"]);
  assert.equal(scope.filters, "--filter=@mentor/web...");
});

const selector = fileURLToPath(new URL("./ci-scope.mts", import.meta.url));

test("invalid commit metadata fails before any output can certify an empty selection", () => {
  const output = join(tmpdir(), `mentor-ci-scope-${randomUUID()}.out`);
  const result = spawnSync(process.execPath, ["--experimental-strip-types", selector], {
    encoding: "utf8",
    env: { ...process.env, CI_FULL: "false", CI_BASE_SHA: "invalid", GITHUB_SHA: "invalid", GITHUB_OUTPUT: output },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /valid base\/head commit SHAs/);
  assert.equal(existsSync(output), false);
});

test("manual release selection needs no PR metadata and emits the full output contract", (t) => {
  const output = join(tmpdir(), `mentor-ci-scope-${randomUUID()}.out`);
  t.after(() => { if (existsSync(output)) unlinkSync(output); });
  const result = spawnSync(process.execPath, ["--experimental-strip-types", selector], {
    encoding: "utf8",
    env: { ...process.env, CI_FULL: "true", CI_BASE_SHA: "", GITHUB_SHA: "", GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: "" },
  });
  assert.equal(result.status, 0, result.stderr);
  const values = Object.fromEntries(readFileSync(output, "utf8").trimEnd().split("\n").map(line => line.split("=")));
  assert.deepEqual(values, { code: "true", full: "true", api: "true", web: "true", admin: "true", filters: "" });
});
