# 0029 — Agent Skills ↔ Standards Integration

> Date: 2026-06-16 · Scope: agent tooling / `.claude/skills` · Related: AGENTS.md §8, devnote 0002

## What was done
- Rewrote four project skills with **Mentor-specific binding rules** (hybrid approach: inline checklist + links to canonical docs):
  - `senior-frontend` ← `docs/standards/frontend.md` + engineering-principles + code-style (FE)
  - `senior-backend` ← `docs/standards/backend.md` + `api.md` + engineering-principles + code-style (BE)
  - `senior-architect` ← `AGENTS.md` + `docs/architecture.md` + workstreams + guardrails
  - `code-reviewer` ← `docs/standards/code-review.md` + engineering-principles + guardrails
- Removed generic Python script boilerplate (not present in this repo).
- Kept canonical source of truth in `docs/standards/*` — skills are agent-facing summaries.

## How to use (usage)
- Invoke skills as before: `/senior-frontend`, `/senior-backend`, `/senior-architect`, `/code-review` (or `code-reviewer`).
- When standards change, update **both** the standard doc and the corresponding skill (skill = binding summary, doc = full detail).
- Performance rules for FE still come from the external `vercel-react-best-practices` skill (`skills-lock.json`).

## Gotchas
- Skills in `.claude/skills/` are tracked in repo; external skills (vercel, find-skills) install via `skills-lock.json` and are gitignored.
- Don't duplicate the full service catalog in skills — link to `docs/standards/api.md` §6 and update there.
- Other skills (`brainstorming`, `mobile-design`, `ui-ux-pro-max`, `webapp-testing`) were not updated in this pass — can follow the same pattern later.
- **Follow-up audit:** admin vs web split documented in `senior-frontend`; SWR/RQ removed (not in codebase); fetch pattern clarified; `code-reviewer` added to AGENTS.md §8.

## Related files & decisions
- `.claude/skills/{senior-frontend,senior-backend,senior-architect,code-reviewer}/SKILL.md`
- `docs/standards/{frontend,backend,api,code-review,engineering-principles,code-style}.md`
- Decision: hybrid content strategy — binding rules inline, details via doc links (avoids drift from two full copies).
