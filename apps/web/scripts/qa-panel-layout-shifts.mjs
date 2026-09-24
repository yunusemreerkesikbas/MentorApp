import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";

const webUrl = process.env.QA_WEB_URL;
const apiUrl = process.env.QA_REAL_API_URL;
const outputPath = process.env.QA_OUTPUT;
if (webUrl !== "http://localhost:3100" || apiUrl !== "http://localhost:3101/v1" || !outputPath) {
  throw new Error("Use the isolated QA web/API and an explicit QA_OUTPUT path.");
}

const viewport = process.env.QA_VIEWPORT === "desktop"
  ? { width: 1280, height: 800 }
  : { width: 375, height: 812 };
const HERO_READY_TIMEOUT_MS = 10_000;
const OBSERVE_AFTER_READY_MS = 500;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport, serviceWorkers: "block" });
try {
  const suffix = randomUUID().slice(0, 8);
  const signup = await context.request.post(`${apiUrl}/auth/signup`, {
    data: {
      email: `qa-shift-${suffix}@example.test`,
      password: "MentorQa!2026",
      displayName: "QA Shift",
      username: `qa_shift_${suffix}`,
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

  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__qaShifts = [];
    window.__qaTimeline = [];
    const capture = () => {
      const children = [
        ...document.querySelectorAll("main > div.flex > *"),
        ...document.querySelectorAll("main > div.grid > .flex > *"),
      ];
      window.__qaTimeline.push({
        at: performance.now(),
        children: children.map((node) => ({
          label: node.getAttribute("data-testid") ?? node.textContent?.trim().slice(0, 45) ?? node.tagName,
          y: Math.round(node.getBoundingClientRect().y),
          height: Math.round(node.getBoundingClientRect().height),
        })),
      });
    };
    window.__qaShiftTimer = setInterval(capture, 50);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__qaShifts.push({
          value: entry.value,
          startTime: entry.startTime,
          sources: entry.sources?.map((source) => ({
            node: source.node?.outerHTML?.slice(0, 350) ?? null,
            previousRect: source.previousRect,
            currentRect: source.currentRect,
          })) ?? [],
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  const results = [];
  for (let iteration = 1; iteration <= 3; iteration++) {
    await page.goto(`${webUrl}/panel`, { waitUntil: "load" });
    await page.getByTestId("today-path-card").waitFor({
      state: "visible",
      timeout: HERO_READY_TIMEOUT_MS,
    });
    await page.waitForTimeout(OBSERVE_AFTER_READY_MS);
    results.push({
      iteration,
      finalPath: new URL(page.url()).pathname,
      shifts: await page.evaluate(() => {
        window.clearInterval(window.__qaShiftTimer);
        return window.__qaShifts;
      }),
      timeline: await page.evaluate(() => window.__qaTimeline),
    });
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), viewport, results }, null, 2)}\n`);
  console.log(results.map((result) => ({
    iteration: result.iteration,
    finalPath: result.finalPath,
    cls: result.shifts.reduce((sum, shift) => sum + shift.value, 0),
    sources: result.shifts.flatMap((shift) => shift.sources.map((source) => source.node?.slice(0, 120))),
  })));
  const maxCls = Number(process.env.QA_MAX_CLS);
  if (process.env.QA_MAX_CLS && results.some((result) =>
    result.shifts.reduce((sum, shift) => sum + shift.value, 0) > maxCls,
  )) throw new Error(`Panel CLS exceeded ${maxCls}`);
} finally {
  await context.close();
  await browser.close();
}
