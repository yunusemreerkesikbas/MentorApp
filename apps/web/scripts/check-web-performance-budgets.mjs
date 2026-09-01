import { appendFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateBudgets,
  measureMessageScopes,
  measureRoute,
} from "./web-performance-budgets.mjs";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const nextDir = join(appDir, ".next");

const routeFiles = {
  article: {
    clientReferenceManifest:
      "server/app/[locale]/knowledge/[slug]/page_client-reference-manifest.js",
    buildManifest:
      "server/app/[locale]/knowledge/[slug]/page/build-manifest.json",
    fontManifest:
      "server/app/[locale]/knowledge/[slug]/page/next-font-manifest.json",
    fontEntrySuffix: "apps/web/src/app/[locale]/knowledge/[slug]/page",
  },
  dashboard: {
    clientReferenceManifest:
      "server/app/[locale]/(app)/dashboard/page_client-reference-manifest.js",
    buildManifest:
      "server/app/[locale]/(app)/dashboard/page/build-manifest.json",
  },
};

const limits = {
  articleRouteAttributableBytes: 704 * 1024,
  articleTotalBytes: 985 * 1024,
  dashboardRouteAttributableBytes: 715 * 1024,
  dashboardTotalBytes: 1287 * 1024,
  articleFontPreloadCount: 2,
  rootMessageBytes: 1024,
  welcomeMessageBytes: 2048,
  articleMessageBytes: 6144,
};

function kib(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function renderSummary(report) {
  const status = report.violations.length === 0 ? "PASS" : "FAIL";
  const rows = [
    ["Article route-attributable JS", kib(report.metrics.articleRouteAttributableBytes), "704 KiB"],
    ["Article total JS", kib(report.metrics.articleTotalBytes), "985 KiB"],
    ["Dashboard route-attributable JS", kib(report.metrics.dashboardRouteAttributableBytes), "715 KiB"],
    ["Dashboard total JS", kib(report.metrics.dashboardTotalBytes), "1287 KiB"],
    ["Article font preloads", String(report.metrics.articleFontPreloadCount), "2"],
    ["Root client messages", `${report.metrics.rootMessageBytes} B`, "1024 B"],
    ["Welcome client messages", `${report.metrics.welcomeMessageBytes} B`, "2048 B"],
    ["Article client messages", `${report.metrics.articleMessageBytes} B`, "6144 B"],
  ];
  return [
    `## Web performance budgets: ${status}`,
    "",
    "| Metric | Actual | Limit |",
    "| --- | ---: | ---: |",
    ...rows.map(([name, actual, limit]) => `| ${name} | ${actual} | ${limit} |`),
    "",
  ].join("\n");
}

async function main() {
  const [article, dashboard, messages] = await Promise.all([
    measureRoute(nextDir, routeFiles.article),
    measureRoute(nextDir, routeFiles.dashboard),
    measureMessageScopes({
      messagesDir: join(appDir, "messages"),
      scopesPath: join(appDir, "src", "i18n", "route-message-scopes.json"),
    }),
  ]);

  const metrics = {
    articleRouteAttributableBytes: article.routeAttributableBytes,
    articleTotalBytes: article.totalBytes,
    dashboardRouteAttributableBytes: dashboard.routeAttributableBytes,
    dashboardTotalBytes: dashboard.totalBytes,
    articleFontPreloadCount: article.fontPreloadCount,
    rootMessageBytes: messages.root.maxBytes,
    welcomeMessageBytes: messages.welcome.maxBytes,
    articleMessageBytes: messages.article.maxBytes,
  };
  const violations = evaluateBudgets(metrics, limits);
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    routes: { article, dashboard },
    messages,
    metrics,
    limits,
    violations,
  };
  const reportPath = join(nextDir, "web-performance-budget-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const summary = renderSummary(report);
  console.log(summary);
  console.log(`Detailed report: ${reportPath}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  }

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(
        `${violation.key} exceeds its budget by ${violation.overBy} (${violation.actual} > ${violation.limit})`,
      );
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
