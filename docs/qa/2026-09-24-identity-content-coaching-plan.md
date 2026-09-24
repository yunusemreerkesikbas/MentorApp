# Mentor QA — Stage 2 identity, content and coaching scenario matrix

**Status on 24 September 2026: planned, not executed as a Stage 2 wave.** Stage 1 identity
security assertions and the panel follow-up are reported in
[the Stage 1 report](2026-09-24-security-performance.md). This matrix defines the next run and
its data before any result is called a pass.

## Environment and reusable data

- Use the same isolated `mentor_test` database, fake AI/payment/email/storage providers, API on
  `localhost:3101` and a production Next web build on `localhost:3100`. Hash the current source
  overlay again before execution; Stage 1 hashes do not cover later work.
- Create **two student accounts once per browser project** (TR and EN), then log in per scenario.
  Add a Free account, a test-only Premium entitlement through the fake subscription path, and
  an account without `examType` for onboarding. Reuse accounts to stay within signup's 5/min
  limit. Reset plan, session, notebook and exam rows between stateful scenarios.
- Seed one **synthetic future** KPSS exam date and a separate exam with no future date in the
  isolated database. Seed a published article with source URL, verifier and verified timestamp,
  plus an unpublished draft and a second exam family's article. These are QA fixtures, not
  statements about real exam dates. Keep payment and live AI calls disabled.
- Run real-API Chrome checks at 375×812 and 1280×800. Existing mock-API Playwright cases are
  useful for edge states but must be listed separately. Capture a screenshot/trace for a visual
  mismatch or ambiguous navigation, and record expected/actual/status, duration, source hash and
  evidence for every case.

## Identity

| ID | Scenario and data | Expected result | Primary check |
| --- | --- | --- | --- |
| I01 | Anonymous TR/EN signup, consent rejection, duplicate identifier and valid student signup. | Invalid consent/duplicate data gets a localized, usable error; valid signup establishes only the web session. | API auth E2E + real-API Chrome auth flow. |
| I02 | New student with no exam; choose KPSS, then reload and open a second tab. | Onboarding persists `examType`, panel opens in the chosen language, and both tabs restore the session without durable access-token storage. | Real-API Chrome mobile/desktop. |
| I03 | Wrong password, forgot/reset flow via fake email, old session after reset. | Login failure does not reveal account existence; reset link is single-use and old session cannot reach protected data. | API identity E2E + real-API browser error/success. |
| I04 | Web login, logout, expired/failed refresh and protected deep link in TR/EN. | Return path is retained where intended; protected content redirects to login and does not flash private data. | Real-API Chrome plus existing auth/routing specs. |

## Editorial content

| ID | Scenario and data | Expected result | Primary check |
| --- | --- | --- | --- |
| C01 | Anonymous TR/EN Blog hub, family/category/page filters and published article. | Public SSR content, URL filters and localized chrome work; only published article appears. | Existing `knowledge.spec.ts` plus real-API Chrome. |
| C02 | Published article, draft slug, bad slug and missing source metadata in fixture write. | Article displays trust source/verification; draft and missing slug stay hidden; editorial write rejects missing trust fields. | Content/admin-content API E2E + real-API Chrome. |
| C03 | Synthetic future `EXAM_DATE`, past-only calendar and KPSS/YKS/LGS taxonomy. | Countdown uses the editorial future date only; no invented date appears for past-only data; exam-specific subject/topic pickers load. | Content API E2E + panel/Blog browser check. |
| C04 | Old `/bilgi` URL, direct article URL, query and EN route. | Permanent redirect preserves the relevant path/query; canonical destination and back/login navigation work. | Installed Chrome navigation/response check. |

## Coaching daily loop

| ID | Scenario and data | Expected result | Primary check |
| --- | --- | --- | --- |
| K01 | Free TR student adds, completes, reopens and deletes plan tasks; another student attempts access. | Today/plan stay in sync, own changes survive reload, another account receives no private task. | Coaching/RLS API E2E + real-API Chrome. |
| K02 | Empty day, delayed today API, 503/retry and 429 response. | Calm empty/loading/error states; one explicit retry succeeds; no unbounded retry loop. | Real-API Chrome for success; labeled response-mock cases for faults. |
| K03 | Mood check-in, short and long study sessions, feedback and history. | Mood saves once; duration rules update streak/focus correctly; feedback/history persist without duplicating a session. | Coaching API E2E + real-API Chrome mobile/desktop. |
| K04 | Mock exam with valid/invalid counts, then analysis focus and notebook handoff. | Net and trend use server rules; invalid totals fail without partial save; linked notebook/plan state reflects the owned exam only. | Coaching/analysis API E2E + real-API Chrome. |
| K05 | Free and fake-Premium student open AI-assisted coaching/plan entry points. | Free sees a bounded right/paywall gate without an AI request; Premium reaches the fake provider path; neither path leaks raw AI chat to another role. | Existing plan/coach browser specs + targeted real-API request assertions. |

## Execution order and decision gate

1. Freeze the source hashes and seed/reset helpers. Run targeted API suites: `auth`, `content`,
   `admin-content`, `coaching`, `analysis-improvement` and the relevant RLS cases. Record suite
   counts and duration. Reuse the Stage 1 identity results only as historical evidence.
2. Run I01–I04 and C01–C04 in installed Chrome with the real API. Add only the missing browser
   assertions after inspecting existing specs. Keep mocked-error checks explicitly labeled.
3. Run K01–K05 in real-API Chrome, then the targeted existing Playwright fixtures for states that
   require fake AI or a deterministic 503/429. Cover TR/EN and Free/Premium where the scenario
   has user-facing copy or entitlement behavior; run mobile and desktop for each visual flow.
4. Write a dated results table with PASS/FAIL/BLOCKED and evidence. For any P0/P1, first keep a
   failing reproduction, make the smallest correction and rerun that case. Review the result
   before advancing to AI/economy/payments/notifications. Full CI remains the PR/release gate.
