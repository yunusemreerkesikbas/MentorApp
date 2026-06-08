# 0006 — .gitignore & Repo Hygiene

> Date: 2026-06-07 · Scope: repo config · Related: project structure review

## What was done
- **Skill libraries no longer committed:** `.agents/`, `.agent/`, `.cursor/`, `.codex/`, `.github/prompts/`
  added to `.gitignore` (was ~378 files / 4.5M of third-party content; `ui-ux-pro-max` was mirrored 4×).
  The manifest `skills-lock.json` **is** tracked → devs reinstall skills locally.
- **Kept tracked:** `.github/workflows/ci.yml` (only `.github/prompts` is ignored), `skills-lock.json`, `.env.example`, `pnpm-lock.yaml`.
- **Removed redundant** `apps/web/.gitignore` + `apps/admin/.gitignore` (root covers them); added `next-env.d.ts` to the root ignore (it was covered by the per-app files).
- **Hardened** `.gitignore`: `*.pem`, `*.tgz`, `.vscode/*` (except `extensions.json`), `next-env.d.ts`.
- **Added `LICENSE`** — proprietary "All Rights Reserved" notice (not OSI). Matches `package.json` `"license": "UNLICENSED"`.
  Copyright holder placeholder `Mentor` → replace with the legal entity once company setup is done (§12 / Phase 0).

## Result
- Tracked files: **~486 → ~109** (apps 56 · packages 29 · docs 20 · root). Cleaner diffs/PRs, ~4.5M lighter.

## Gotchas
- Don't re-commit the skill dirs; they're tool-installed and reproducible from `skills-lock.json`.
- The repo has **no commits yet** — these ignores prevent the skill libs from ever being staged (no `git rm` needed).

## Related files & decisions
- `.gitignore` · `LICENSE` · `skills-lock.json`
