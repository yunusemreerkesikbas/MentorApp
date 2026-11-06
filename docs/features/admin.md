# Admin Panel & Back-Office API (`modules/admin` · `apps/admin` · W6)

> Internal RBAC-gated operations console (`apps/admin` on Next.js 16 / React 19 + Bootstrap 5 Duralux)
> and `/v1/admin/*` endpoints: user/coach/waitlist management, KVKK export & anonymization, content &
> calendar editors, subscription refunds, promotions, ads readiness, runtime config, and KPI metrics.

---

## 1. Overview & Architecture

`AdminModule` is a pure orchestrator over other modules' exported public services — it **never**
queries another bounded context's tables directly (`AGENTS.md` §2). All admin repository operations
run in `withServiceContext`, and every mutating endpoint writes an immutable row to
`admin_audit_log` via `@UseInterceptors(AdminAuditInterceptor)` + `@Audit('<action>')`.

- **Least-Privilege RBAC Matrix (`RolesGuard`):**
  - **Umbrella Full Access:** `SUPER_ADMIN` and `ADMIN` pass all `@Roles(...)` checks.
  - **`SUPPORT`:** User search/detail, user status (`ACTIVE`/`SUSPENDED`/`BANNED` for non-staff/non-admin accounts), coach registry status, waitlist management, read-only metrics.
  - **`FINANCE`:** Subscription view, record-only/provider refund, subscription cancel, plan catalog `PATCH`, promotions CRUD, economy manual adjustment, revenue/AI/sponsorship metrics.
  - **`CONTENT_EDITOR` (`EDITOR`):** Knowledge-center `/bilgi` articles, exam calendar events, curated forum tags, and public/community Q&A & announcement ad-review approvals.
  - **`MODERATOR`:** Forum/community report queue resolution.
- **Root-Admin & Staff Lockout Guards (`2026-11-05`):**
  - Accounts holding `SUPER_ADMIN` or `ADMIN` cannot be suspended, banned, or anonymized via the API (`403 FORBIDDEN`).
  - Scoped `SUPPORT` operators cannot alter the status of any internal panel or `STAFF` account (`ADMIN_PANEL_ROLES` / `STAFF`), checked under a `FOR UPDATE` row lock.
  - No operator can modify or anonymize their own account (`ADMIN_CANNOT_MODIFY_SELF`).
- **Separate Admin Auth Cookie (`2026-09-23`):** `apps/admin` authenticates via `/v1/auth/admin/{login,refresh,logout}` using its own `mentor_admin_refresh` cookie so signing out of admin never logs out the operator's B2C web session.

---

## 2. API Surface (`/v1/admin/*`)

| Endpoint Group                                                                              | Role(s)                                    | Purpose                                                                                      |
| ------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `GET /v1/admin/users`, `GET .../:id`, `PATCH .../:id/status`                                | `SUPPORT`, `FINANCE` (`PATCH` = `SUPPORT`) | Search users (`?q=&role=`), inspect detail, change status (audited)                          |
| `GET /v1/admin/users/:id/export`, `POST .../:id/anonymize`                                  | `SUPER_ADMIN`                              | KVKK JSON export and PII-scrubbing anonymization (audited)                                   |
| `POST\|DELETE /v1/admin/users/:id/roles/:role`                                              | `SUPER_ADMIN`                              | Grant/revoke `STAFF` or sub-roles (audited)                                                  |
| `GET\|POST /v1/admin/waitlist*`                                                             | `SUPPORT`, `SUPER_ADMIN`                   | List pilot waitlist requests, approve/invite (`signup_invitations`), or resend               |
| `GET /v1/admin/coaches`, `POST .../:userId/{status,verified-claims}`                        | `SUPPORT`, `SUPER_ADMIN`                   | Coach registry oversight and verified claim badges (audited)                                 |
| `GET /v1/admin/users/:id/subscription`, `POST .../{refund,cancel}`                          | `FINANCE`                                  | Inspect user subscription, issue capped refund, or cancel renewal (audited)                  |
| `GET /v1/admin/plans`, `PATCH /v1/admin/plans/:id`                                          | `FINANCE`                                  | Edit plan name, price, trial days, and active status (audited)                               |
| `GET\|POST\|PATCH /v1/admin/promotions*`                                                    | `FINANCE`                                  | Manage discount campaigns and coupon codes (audited)                                         |
| `GET /v1/admin/ads/readiness`, `GET\|PUT\|DELETE /v1/admin/ads/{questions,announcements}/*` | `SUPER_ADMIN` / `EDITOR`                   | 8-placement AdSense readiness diagnostics and content-revision ad approvals                  |
| `GET\|POST /v1/admin/content/{articles,exams}*`                                             | `EDITOR`                                   | `/bilgi` article CRUD + publish/unpublish and official exam calendar editor                  |
| `GET /v1/admin/users/:id/economy`, `POST .../adjust`                                        | `SUPPORT`, `FINANCE` (`POST` = `FINANCE`)  | Inspect ledger/quests and perform manual XP/Coin adjustment (audited)                        |
| `GET /v1/admin/metrics{,/ai,/economy,/coach-feedback,/sponsorship}`                         | `SUPPORT`, `FINANCE`                       | KPI snapshots (includes `KPSS/YKS/LGS/ALES/DGS` cohorts, LLM spend, and coach seat cost)     |
| `GET /v1/admin/config`, `PATCH /v1/admin/config/:key`                                       | `SUPER_ADMIN`                              | Runtime config catalog & feature flag editor with Turkish operator hints (`config-hints.ts`) |
| `GET /v1/admin/audit-log`                                                                   | `SUPER_ADMIN`                              | Paginated immutable admin audit trail                                                        |

---

## 3. Geliştirmeler (Condensed Milestone Timeline)

- **2026-11-05 — Root-Admin Lockout Protection, SUPPORT Boundary & Pilot Waitlist Console (`APP-138`):** Hardened `AdminUsersService.setStatus` and `anonymize` under `FOR UPDATE` row locks so root admins cannot be locked out and `SUPPORT` cannot suspend fellow staff; shipped `/waitlist` admin management for invite-only pilot admission.
- **2026-11-01..03 — 5-Exam Cohort Metrics (`ALES`/`DGS`), Wrapped Policy & Notebook Slot Config:** Extended `/v1/admin/metrics` and content/announcement forms to all 5 exam families (`EXAM_CATALOG`), and added `/config` controls for Weekly Recap ownership (`coaching.weekly_recap.*`) and Coin notebook slots (`economy.notebook_slots.*`).
- **2026-10-26..31 — Display Ads Readiness Summary, Free-Tier Notebook Quotas & CORS Fix:** Added `AdsReadinessSummary.tsx` (`GET /v1/admin/ads/readiness`) and 5 free-tier notebook quota keys to `/config`, and fixed local `ADMIN_APP_URL` (`:3002`) CORS defaults.
- **2026-09-06..23 — Next.js 16 / React 19 Upgrade (`APP-084`), Separate Admin Auth Cookie & Duralux Dashboard Kit:** Upgraded `apps/admin` to Next 16 / React 19, isolated `mentor_admin_refresh`, replaced pre-approval queue with self-service Coach Registry (`/coaches`), and unified dashboard KPI widgets + 133 Turkish config hints.
- **2026-07-16..20 — W6 Admin Foundation (`0021–0025`):** Shipped `admin_audit_log`, fine RBAC sub-roles, user management + KVKK anonymize, content/calendar editors, refund/cancel, and `/config` registry UI.
