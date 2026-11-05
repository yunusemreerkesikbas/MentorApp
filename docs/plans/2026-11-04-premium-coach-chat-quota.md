# Premium Coach Chat Quota Implementation Plan

**Goal** Set a configurable Premium chat allowance of 20 per rolling day and 100
per rolling 30 days, shared by normal chat, streaming and regeneration.

**Architecture** Keep the policy and atomic admission in the AI module. Extend
the existing catalog, access probe and cost metering without adding endpoints.

**Tech Stack** NestJS, Drizzle, PostgreSQL, Next.js and Vitest.

## Global Constraints

Only Premium chat generation uses this policy. Official information and safety
keep their local decision paths. Provider failure after admission consumes quota.
Actual token and cost metrics continue to come from the usage meter.

## Review Focus

Exercise the last slot under concurrent requests, settlement without double
counting, the later of two renewal times and the quota-exhausted chat experience.

## Task 1 — Policy, persistence and settings

Add the monthly catalog setting, lower the daily default, and migrate the
service-only admission table. Test rolling-window expiry and refusal details.

## Task 2 — Provider boundary and API

Admit after the global budget check and before dispatch. Pass the admission id
through successful results and settle it with metered usage. Update the existing
access probe and verify that all three generation entry points share admission.

## Task 3 — Web and operator behavior

Keep the chat view available on quota refusal and show the server's next usable
time. Add Turkish and English copy, admin hints and a feature timeline entry.
Verify the affected API and web surfaces with targeted checks.
