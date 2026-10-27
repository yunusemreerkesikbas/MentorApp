import { defineConfig } from "@playwright/test";
import base from "./playwright.question-ads.config";

export default defineConfig({ ...base, testMatch: ["community-question-ads.spec.ts", "community-overview-ads.spec.ts", "community-announcement-ads.spec.ts"], outputDir: ".next/community-question-ads-results" });
