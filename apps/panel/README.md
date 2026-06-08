# apps/panel — Coach + B2B Panel (Phase 2)

> **Status:** Placeholder. In MVP there is no coach panel and no B2B panel (§10). Verifier = team + AI.

## Planned stack
- **Next.js** (web, role-based) — the coach's primary environment + B2B org-admin (§9).
- Role boundaries (§9): `COACH` (student-level operator) vs `ORG_ADMIN` (management/umbrella layer).
- Coach: student list/status, plan/assignment, reports, forum answer/verify, AI "smart brief".
- B2B: coach↔student assignment, bulk plan/assignment, institutional reports, license/seat + billing.
- Phase 2 thin **native companion** (mobile) → in-app browser bridge to the web panel + token handoff.

## Data model readiness
The MVP data model is **org_id / CoachStudent ready** from day one (unused) → when this panel opens,
the schema won't break (§10 invisible foundations).

Setup is not done in this phase; the skeleton only reserves the monorepo slot.
