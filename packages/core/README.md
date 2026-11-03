# @mentor/core

Framework-agnostic **domain constants/helpers**. Exam-agnostic config lives here (§0): e.g.
`NET_PENALTY_DIVISOR` (KPSS/YKS/ALES/DGS ÷4, LGS ÷3). Authoritative mock-exam calculations
use the selected exam's editorial `net_rule` in the API, not this display/config constant.

**Rule:** no knowledge of NestJS/Next (pure TS). Exam differences via *config*, not code branching.
Canonical guide: [`../../AGENTS.md`](../../AGENTS.md).
