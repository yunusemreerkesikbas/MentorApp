# Analiz Phase 3 — Backlog Epic

> Deferred from the 2026-07-04 analiz redesign. Track separately; do not scope-creep into P1/P2 PRs.

## Features

| Item | Description | Modules |
|------|-------------|---------|
| OCR auto-fill | Photo of result sheet → auto D/Y/B (roadmap F2) | AI vision + coaching validation |
| Weekly AI summary | Scheduled job + cached premium narrative | AI + coaching + jobs |
| Delete / edit attempts | `DELETE/PATCH /v1/mock-exams/:id` | coaching |
| Subject time series | Per-subject net over time on `GET /coaching/analysis` | coaching |
| Plan integration | "Add focus task for weak subject" CTA | coaching → plan port |
| Coach context injection | `contextMockExamId` on `POST /v1/coach/chat` | AI context builder |

## Notes

- OCR must respect guardrails: categorize/parse only; no solution generation.
- Weekly summary copy must stay encouraging; no cross-user ranking.
- Delete/edit requires audit/idempotency review (append-only spirit for behavioral history).
