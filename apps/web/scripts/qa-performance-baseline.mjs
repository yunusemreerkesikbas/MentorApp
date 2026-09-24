import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";

const webUrl = process.env.QA_WEB_URL;
const apiUrl = process.env.QA_REAL_API_URL;
const outputPath = process.env.QA_OUTPUT;
if (webUrl !== "http://localhost:3100" || apiUrl !== "http://localhost:3101/v1" || !outputPath) {
  throw new Error("Use the isolated localhost:3100 web, localhost:3101/v1 API and QA_OUTPUT path.");
}

const routes = [
  { name: "welcome", path: "/", authenticated: false },
  { name: "article", path: "/blog/kpss-basvuru-sureci", authenticated: false },
  { name: "dashboard", path: "/panel", authenticated: true },
  { name: "analysis", path: "/analiz", authenticated: true },
];
const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
];

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function makeAuthenticatedContext(browser, viewport) {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  const suffix = randomUUID().slice(0, 8);
  const signup = await context.request.post(`${apiUrl}/auth/signup`, {
    data: {
      email: `qa-perf-${suffix}@example.test`,
      password: "MentorQa!2026",
      displayName: "QA Performance",
      username: `qa_perf_${suffix}`,
      kvkkAccepted: true,
      termsAccepted: true,
      ageEligibilityConfirmed: true,
      intent: "STUDENT",
    },
  });
  if (signup.status() !== 201) throw new Error(`QA signup returned ${signup.status()}`);
  const session = await signup.json();
  const profile = await context.request.patch(`${apiUrl}/users/me`, {
    data: { examType: "KPSS" },
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (profile.status() !== 200) throw new Error(`QA profile returned ${profile.status()}`);
  return context;
}

async function measure(page, cdp, route, cacheDisabled, counters) {
  await cdp.send("Network.setCacheDisabled", { cacheDisabled });
  counters.bytes = 0;
  counters.api = [];
  const started = Date.now();
  const response = cacheDisabled
    ? await page.goto(`${webUrl}${route.path}`, { waitUntil: "load" })
    : await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(1_000);
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const vitals = window.__qaVitals ?? { lcp: null, cls: 0 };
    return {
      ttfbMs: nav ? nav.responseStart - nav.requestStart : null,
      loadMs: nav ? nav.loadEventEnd - nav.startTime : null,
      lcpMs: vitals.lcp,
      cls: vitals.cls,
    };
  });
  const apiCalls = counters.api.map(({ path, status }) => ({ path, status }));
  return {
    httpStatus: response?.status() ?? null,
    finalPath: new URL(page.url()).pathname,
    wallMs: Date.now() - started,
    transferredBytes: Math.round(counters.bytes),
    ...timing,
    apiCalls,
  };
}

const browser = await chromium.launch();
const samples = [];
try {
  for (const viewport of viewports) {
    const publicContext = await browser.newContext({ viewport, serviceWorkers: "block" });
    const privateContext = await makeAuthenticatedContext(browser, viewport);
    try {
      for (const route of routes) {
        const context = route.authenticated ? privateContext : publicContext;
        const page = await context.newPage();
        await page.addInitScript(() => {
          window.__qaVitals = { lcp: null, cls: 0 };
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) window.__qaVitals.lcp = entry.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) window.__qaVitals.cls += entry.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        const counters = { bytes: 0, api: [] };
        cdp.on("Network.loadingFinished", (event) => { counters.bytes += event.encodedDataLength; });
        page.on("response", (response) => {
          if (!response.url().startsWith(apiUrl)) return;
          counters.api.push({
            path: new URL(response.url()).pathname.replace(/^\/v1/, ""),
            status: response.status(),
          });
        });
        for (let iteration = 1; iteration <= 5; iteration++) {
          const cold = await measure(page, cdp, route, true, counters);
          const warm = await measure(page, cdp, route, false, counters);
          samples.push({ viewport: viewport.name, route: route.name, iteration, cold, warm });
          console.log(`${viewport.name} ${route.name} ${iteration}/5 cold=${Math.round(cold.wallMs)}ms warm=${Math.round(warm.wallMs)}ms`);
        }
        await page.close();
      }
    } finally {
      await publicContext.close();
      await privateContext.close();
    }
  }
} finally {
  await browser.close();
}

const summary = viewports.flatMap((viewport) => routes.map((route) => {
  const group = samples.filter((sample) => sample.viewport === viewport.name && sample.route === route.name);
  return {
    viewport: viewport.name,
    route: route.name,
    cold: Object.fromEntries(["ttfbMs", "loadMs", "lcpMs", "cls", "wallMs", "transferredBytes"]
      .map((key) => [key, median(group.map((sample) => sample.cold[key]))])),
    warm: Object.fromEntries(["ttfbMs", "loadMs", "lcpMs", "cls", "wallMs", "transferredBytes"]
      .map((key) => [key, median(group.map((sample) => sample.warm[key]))])),
    apiFailures: group.flatMap((sample) => [...sample.cold.apiCalls, ...sample.warm.apiCalls])
      .filter((call) => call.status >= 400),
  };
}));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), samples, summary }, null, 2)}\n`);
console.log(`Saved ${samples.length * 2} loads to ${outputPath}`);
