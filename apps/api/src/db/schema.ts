/**
 * Drizzle schema (§11 conceptual data model).
 *
 * SKELETON: tables are added as the relevant modules are developed. Design rules:
 *  - The data model is **org_id / coach-ready** from day one (even if unused) → Phase 2/3 won't break (§10).
 *  - Economy = append-only LedgerEntry (XP/COIN, PENDING/CONFIRMED/REVERSED); balance = sum of rows, never delete (§3/§11).
 *  - pgvector is **content only** (InfoArticle/forum snapshot), not behavioral data (§8).
 *  - Trust metadata is mandatory on every InfoArticle record (source/effective_date/last_verified_at/status) (§1).
 *  - `jobs` table (MVP queue): id/name/payload/status/attempts/run_at — processed by the Render Cron worker
 *    (the JobQueuePort MVP adapter). Hands off to BullMQ+Redis in Phase 2.
 *
 * First modules (MVP): identity, content, payments + ledger foundation + jobs.
 */

export {};
