# Analiz Phase 3 — Backlog Epic

> Deferred from the 2026-07-04 redesign. Status refreshed after the actionable three-tab delivery on 2026-07-13.

## Features

| Item                    | Description                                                  | Modules                         | Status                                |
| ----------------------- | ------------------------------------------------------------ | ------------------------------- | ------------------------------------- |
| OCR auto-fill           | Photo of result sheet → auto D/Y/B (roadmap F2)              | AI vision + coaching validation | Backlog                               |
| Weekly AI summary       | Completed-week rule summary + cached premium narrative       | AI + coaching + jobs            | Partially shipped; scheduling remains |
| Delete / edit attempts  | PUT/DELETE /v1/mock-exams/:id                                | coaching                        | Shipped 2026-07-11                    |
| Subject time series     | Latest-four net trend for the selected focus subject         | coaching                        | Shipped 2026-07-13                    |
| Plan integration        | Prefill a focus task; explicit user confirmation before save | coaching → plan                 | Shipped 2026-07-10                    |
| Coach context injection | contextMockExamId on POST /v1/coach/chat                     | AI context builder              | Backlog                               |

## Notes

- OCR must respect guardrails: parse/classify only; never generate a solution.
- Weekly copy must stay encouraging; no cross-user ranking.
- Edit/delete is server-recomputed and owned-record scoped.
- The shipped focus series intentionally covers only the latest four attempts; full per-subject history remains out of scope.
