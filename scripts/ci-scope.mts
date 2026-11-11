import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface CiScope {
  code: boolean;
  full: boolean;
  api: boolean;
  web: boolean;
  admin: boolean;
  mobile: boolean;
  filters: string;
}

const DOCUMENTATION = /^(?:docs\/|marketing\/|design\/|\.github\/agents\/)|\.md$|^(?:LICENSE|skills-lock\.json)$/;
const SENSITIVE = [
  /^apps\/api\/src\/modules\/(?:identity|payments|economy|promotions|ai|mentorship)\//,
  /^apps\/api\/(?:drizzle\/|src\/(?:database|common|shared)\/)/,
  /^apps\/web\/src\/app\/\[locale\]\/\(auth\)\//,
  /^apps\/web\/src\/app\/\[locale\]\/\(app\)\/subscription\//,
  /^apps\/web\/src\/(?:proxy\.ts|lib\/(?:auth|post-auth|account-security|security-headers|signup-waitlist))/,
  /^apps\/web\/e2e\/(?:account-security|browser-security|core-trial)/,
  /^apps\/(?:api|web|admin|mobile)\/(?:package\.json|[^/]*config[^/]*)$/,
  /^packages\/(?!ui\/)/,
  /^packages\/ui\/package\.json$/,
];

/** Unknown executable/config paths deliberately request full coverage. */
export function selectCiScope(paths: string[], forceFull = false): CiScope {
  let full = forceFull;
  let api = false;
  let web = false;
  let admin = false;
  let mobile = false;
  for (const path of paths) {
    if (DOCUMENTATION.test(path)) continue;
    if (SENSITIVE.some(pattern => pattern.test(path))) full = true;
    else if (path.startsWith("apps/api/")) api = true;
    else if (path.startsWith("apps/web/")) web = true;
    else if (path.startsWith("packages/ui/")) {
      web = true;
      mobile = true;
    } else if (path.startsWith("apps/admin/")) admin = true;
    else if (path.startsWith("apps/mobile/")) mobile = true;
    else full = true;
  }
  if (full) api = web = admin = mobile = true;
  const filters = full ? "" : [
    ...(api ? ["--filter=@mentor/api..."] : []),
    ...(web ? ["--filter=@mentor/web..."] : []),
    ...(admin ? ["--filter=@mentor/admin..."] : []),
    ...(mobile ? ["--filter=@mentor/mobile..."] : []),
  ].join(" ");
  return { code: api || web || admin || mobile, full, api, web, admin, mobile, filters };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const forceFull = process.env.CI_FULL === "true";
  let paths: string[] = [];
  if (!forceFull) {
    const base = process.env.CI_BASE_SHA ?? "";
    const head = process.env.GITHUB_SHA ?? "";
    if (![base, head].every(value => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value))) {
      throw new Error("CI requires valid base/head commit SHAs; refusing an empty change selection.");
    }
    paths = execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", base, head, "--"], {
      encoding: "utf8",
    }).split("\0").filter(Boolean);
  }
  const scope = selectCiScope(paths, forceFull);
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required.");
  appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(scope).map(([key, value]) => `${key}=${value}\n`).join(""));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      "## CI scope",
      `Mode: **${scope.full ? "full" : scope.code ? "scoped PR" : "documentation / marketing only"}**`,
      `Applications: ${[scope.api && "API", scope.web && "web", scope.admin && "admin", scope.mobile && "mobile"].filter(Boolean).join(", ") || "none"}`,
      scope.full ? "The full release profile is required." : "This result does not certify the full release profile.",
      "",
    ].join("\n\n"));
  }
}
