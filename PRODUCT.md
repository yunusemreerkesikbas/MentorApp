# PRODUCT.md — PuhuKoç Product Summary

> **Quick English reference** for product scope, audience, and core mechanics.
> Canonical decision record: [`sinav-kocluk-roadmap.md`](./sinav-kocluk-roadmap.md) (Turkish).
> Voice constitution: [`docs/copy/voice.md`](./docs/copy/voice.md). Design system: [`DESIGN.md`](./DESIGN.md).

---

## 1. What PuhuKoç Is

**PuhuKoç** (`puhukoc.com`, repo workspace `@mentor/*`) is an **exam-prep companionship platform** — not a question bank or video course library.

The deepest pain in month-long exam preparation isn't lack of information; it's **loneliness, collapse of motivation, and giving up**. PuhuKoç combines:
1. **Puhu (AI study companion):** Personalizes weekly plans (`Puhu’yla planla`), reflects on study sessions and mood check-ins, narrates weekly progress, and chats one-on-one.
2. **Daily Ritual & Focus:** Structured study timer (`/seans` with Pomodoro/stopwatch, themed rooms `LIBRARY`/`CAFE`/`HOME`, ambient audio, and photo-logged study notebooks), daily mood check-in, and streak protection.
3. **Peer Community & Study Rooms:** Silent shared study tables (`Çalışma Odası`), exam-scoped Q&A forum, XP leagues (`Lig`), and Weekly Recap stories.
4. **Human Mentorship (`/kocum`, `/koclar`):** Optional 1-on-1 link with a real human coach who assigns tasks, tracks readiness signals, prepares meeting notes, and can sponsor student seats.

---

## 2. Exam-Agnostic Architecture

One product engine serves **5 exam families** in catalog order:
**`KPSS · YKS · LGS · ALES · DGS`**

- Rituals, timers, AI coaching, streaks, XP/Coin economy, community rooms, and human coaching work identically across all exams.
- Exams differ **only by configuration and editorial data**: subject/topic taxonomy, net calculation formula (`correct - wrong / N`), official calendar dates, and verified editorial guides (`ContentModule`).
- **Never build a separate codebase vertical per exam.**

---

## 3. Brand, Voice & Visual Identity

- **Brand name:** **PuhuKoç** (typographic `Logo` in `@mentor/ui` with Nunito weight 1000 and Puhu's eye inside the `o`).
- **Dual-register voice ([`docs/copy/voice.md`](./docs/copy/voice.md)):**
  - **Puhu register (energetic, Duolingo-like):** Used across landing, chrome, quests, community, leagues, levels, achievements, weekly nicknames, invites, and unlocks. Lively, warm, cheering, short sentences, max one `!` per sentence, zero shame or FOMO.
  - **Companion register (calm, steady):** Used in AI coach chat, low-mood check-ins, broken streaks, errors, payments, and official exam facts. Grounded (`"Ben buradayım"`), no `!`, no jokes.
- **Naming rule:** The AI coach is always called **Puhu** (`Puhu, yapay zekâ koçun`; in Turkish always `"yapay zekâ"`, never `"AI"`). Plain **"koç"** refers exclusively to a human coach (`mentorship`).
- **Visuals & Typography ([`DESIGN.md`](./DESIGN.md)):**
  - **Font:** **Nunito** (`latin-ext` variable `200–1000`) for all UI and display; **Caveat** (`600/700`) for handwritten paper notes and plates.
  - **Primary CTA:** Tactile **play-ledge button** (`#55ACEE` sky-blue fill, `#0F2233` deep navy ink, `4px` `#3B8FD0` bottom ledge, `16px` radius).
  - **Themes:** Warm daylight canvas (`#FAF6F0`) and dark slate night canvas (`html.dark` `#0F141C`), plus scoped atmospheric scene themes (landing night city, study rooms, weekly chest, paywall, celebrations).

---

## 4. Monetization, Economy & Guardrails

1. **Free vs. Premium (`PaymentsModule`):**
   - **Free:** Full study ritual (weekly plan, focus timer, study rooms, topic tracking, mock exam logging, verified exam calendar/blog, community forum, XP/Coin quests). Unconditional ongoing AI cost on Free is **~0**.
   - **Four ways a Free student tastes AI:**
     1. Carded free trial (7 days default).
     2. Earned right via quests/Coin unlocks or friend invites (`/davet`).
     3. A human coach's sponsored seat (`mentorship.coach.free_seats`, gated on `mentorship.seats.sponsorship_enabled` after SMS OTP).
     4. A human coach's daily assistant taste (`ai.features.mentorship.*.free_enabled`).
   - **Premium:** Unlocks Puhu AI coaching (daily chat within fair-use cap, `Puhu’yla planla`, daily greeting, mood/session reflections, weekly deep analysis & story, unlimited photo notebooks, ad-free experience). Wearing the night-blue hero domino mask (`PremiumIdentityMark` / `variant="premium"`) marks Premium AI surfaces.
2. **Non-Monetary Economy (`EconomyModule`):**
   - **XP** drives the 12-level Night Journey (`Kıvılcım` → `Zirve`) and weekly League cohorts.
   - **Coin** is earned through study consistency (active days, weekly chests, invites) and spent on streak freezes, extra photo notebooks, or single-use AI unlocks. Coin is **strictly non-monetary** (never purchased with cash, never placed inside the AI chat composer).
3. **Trust & Safety Guardrails:**
   - **Official facts** (exam dates, quotas, rules) are rendered from verified `ContentModule` records and data cards — never hallucinated by the LLM.
   - **Photo → Topic** only classifies or organizes study notes; it **never solves questions**.
   - **Student → AI privacy:** Raw confessions in Puhu chat are **never** shown to a student's human coach or institution; human coaches see only aggregated readiness signals and study metrics.
