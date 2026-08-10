# Product

> Strategic context for design and frontend work. Visual tokens live in [`DESIGN.md`](./DESIGN.md).
> Product decisions: [`sinav-kocluk-roadmap.md`](./sinav-kocluk-roadmap.md) · Engineering: [`AGENTS.md`](./AGENTS.md)

## Register

product

## Users

**Primary:** Turkish-speaking exam-prep students (KPSS first seed; product logic is exam-agnostic for YKS/LGS and future exams). They are on a long, lonely, exhausting path — often studying alone for months, with motivation collapse and dropout as the deepest pain, not lack of information.

**Context of use:** Daily rituals — opening the app for a check-in, starting a study session (Pomodoro), logging practice tests, glancing at countdown and plan, asking the AI coach when stuck or demoralized, reading verified exam-process info when anxious about dates or procedures. Mobile-first habits; responsive web is MVP-primary (desktop sidebar adaptation, not a separate product).

**Job to be done:** Stay on the road — feel understood, keep going, and not be left alone. Secondary jobs: know what to study today, see progress without shame, get trustworthy official facts (not hallucinated), and eventually find peers in the same cohort (Phase 2).

**Secondary surfaces (later phases):** Lean admin (content, users, payments) · coach/org panels (Phase 2 B2B) · marketplace participants (Phase 3). Default register remains **product** for all of these — design serves the task, not the campaign.

## Product Purpose

**Mentor** is a **companionship platform** for exam preparation — not a knowledge or question-bank platform. An AI coach plus community (Phase 2+) that **understands, keeps you going, and never leaves you alone** on the hardest stretch of prep.

**What success looks like:**
- Students return daily (ritual: streak, session, check-in) because the product feels like a steady companion, not a cold tool.
- They trust official information (editorial knowledge center + data cards) and the AI coach (grounded, never free-generating critical facts).
- Premium conversion follows **earned taste** of AI (carded trial, invite/quest) — not guilt or shame mechanics.
- Long-term moat: behavioral data early, community network effect at scale (Phase 2+).

**MVP scope (Faz 1):** Responsive web B2C — onboarding · hybrid AI coach · plan + calm exam countdown · Pomodoro + streak · practice-test analysis · knowledge center (A-layer editorial + grounded AI) · freemium subscription · earned AI rights · notifications. Social forum, economy, mobile, and coach marketplace are explicitly **out of MVP** (roadmap phase discipline).

## Brand Personality

**Three words:** Warm · Encouraging · Steady *(Sıcak · Cesaretlendirici · Yoldaş)*

**Voice:** Turkish-first, never shaming. Celebrate effort and consistency, not raw scores. Countdown is calm — not alarm-red. Copy sounds like a patient study partner who remembers your context, not a drill sergeant or a generic chatbot.

**Emotional goals:** Relief from loneliness · renewed motivation without pressure · quiet confidence that "someone is walking with me" · safety when asking embarrassing or fragile questions (AI→teacher trust line: raw confessions stay with the AI; only signals reach coaches).

**Visual personality (strategic, not tokens):** Soft and human on a monochrome-forward Nuton base — black primary actions, white surfaces, pastel blob atmosphere, Plus Jakarta Sans warmth. Premium feel through craft and calm, not through saturated "EdTech purple" or SaaS hero metrics.

**Reference feel (what to borrow, not clone):**
- **Duolingo / streak apps:** daily ritual and delight in small wins — but **without** guilt, shame, or aggressive loss aversion.
- **Headspace / Calm:** emotional safety and non-alarming tone for countdown and setbacks.
- **Notion / Linear (product register):** earned familiarity in app chrome — navigation and forms disappear into the task.

## Anti-references

**Product & positioning — do NOT become:**
- A cold question-bank or content library (SoruBankası-style transactional UX).
- A "ranking" or leaderboard product that sorts by net/score — demoralization and "bottom of the list" shame are explicit product bans.
- An unconditional free AI chatbot (cost and trust guardrails forbid it).
- A forum-first or coin-first economy surface in MVP (Phase 2; coin never belongs in the chat zone).

**UI & marketing patterns — avoid:**
- Generic EdTech SaaS landing clichés: cream/sand body backgrounds, hero-metric blocks (big number + small label + gradient), identical icon-card grids, gradient text, glassmorphism-as-default, numbered section eyebrows (01/02/03) on every screen.
- Alarm-red countdown, panic UX, or shame copy ("you fell behind everyone").
- Duolingo-style streak loss guilt, crying mascots used to manipulate.
- Dark "productivity hacker" terminal aesthetic — this is emotional companionship, not a dev tool.
- Reinvented affordances where standard patterns work (custom modals for everything, weird form controls, decorative motion that doesn't convey state).
- Side-stripe accent borders, nested cards, display typography in dense UI labels.

**Trust anti-patterns:**
- LLM-paraphrased official dates/processes (critical facts = verified data cards only).
- Photo→topic flows that **solve** exam questions (vision categorizes only).

## Design Principles

1. **Companionship over information** — Every screen should answer: does this soothe loneliness, collapse of motivation, or giving up? If it only adds facts, it belongs in the knowledge center, not the emotional core.

2. **Anti-shaming by default** — Compete on effort (hours, streak, consistency), never on exam results. Downward moves use neutral gray, not red. Encouraging Turkish tone; no ranking humiliation.

3. **Earned familiarity** — Product UI should feel as trustworthy as the best task tools (Linear, Notion): consistent components, predictable nav, state-rich controls. Surprise and delight are for moments (onboarding completion, streak milestone), not every page load.

4. **Verified trust line** — Official information always comes from editorial content; AI cites sources and renders critical facts as data cards. The interface must **show** provenance (source, last verified) — transparency is part of companionship.

5. **Calm urgency** — Exam countdown and deadlines are real but never panic-inducing. Motion and color serve state (loading, success, focus), not decoration. Reduced-motion paths are mandatory.

## Accessibility & Inclusion

**Target:** WCAG 2.1 **AA** for student-facing web (contrast, focus, keyboard paths). Admin follows the same bar where feasible.

**Known needs:**
- **Turkish typography:** Full glyph coverage (ç ğ ı İ ş ö ü) — Plus Jakarta Sans with `latin-ext`; no fallback gaps in UI copy.
- **Color:** Body text ≥4.5:1 on backgrounds; UI indicators ≥3:1. Semantic states (`danger`, `success`, `focus-ring`) are defined for forms and keyboard focus — not borrowed from decorative pinks.
- **Motion:** All animations respect `prefers-reduced-motion` (crossfade or instant transition). No content gated behind entrance animations.
- **i18n:** TR default, EN mirrored (`next-intl`); nav and static copy via translation keys — no hardcoded Turkish in components.
- **Emotional accessibility:** Anti-shaming principles extend to how errors, empty states, and "bad" analytics are framed — never punitive language for low scores or missed days.

**Phase note:** LGS and under-18 cohorts may require guardian consent/KVKK UX (roadmap); design should leave room for consent flows without treating minors as an afterthought.
