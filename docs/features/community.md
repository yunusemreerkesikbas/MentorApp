# Community — Study Rooms, Weekly League & Achievements (`modules/community` · W7c)

> Shared top-down study rooms (`/topluluk/oda/[id]`, `/seans`), effort-only Weekly League
> (`/topluluk/lig`), Study Buddy (`/v1/buddy`), public member profiles (`/topluluk/uye/[username]`),
> and the "Işık Yandı" Achievement & Level celebration system.

---

## 1. Overview & Architecture

`CommunityModule` provides peer companionship without exam-score anxiety:

- **Effort-Only Ranking (`AGENTS.md` §0):** The Weekly League (`/topluluk/lig`) ranks **only** XP earned from study effort and consistency (`unit = 'XP'`, scoped to the student's `examType` cohort). Mock exam nets and scores are **never** ranked or displayed.
- **Voice Standard (`docs/copy/voice.md`):** Community, Study Rooms, League, Achievements, and Level ceremonies speak in the **energetic, Duolingo-like Puhu register** (`"Seviye atladın!"`, `"İlk Seans Tamam!"`, `"Masaya otur"`).
- **Clean Module Boundaries:** `CommunityModule` owns `study_rooms`, `study_room_members`, `study_buddies`, and `user_achievements` (all under `FORCE ROW LEVEL SECURITY`). It reads user identities from `IdentityModule`, streak/session signals from `CoachingModule`, forum activity from `ForumModule`, and XP totals from `EconomyModule` via public services.
- **Independent Switches:** `community.study_rooms.enabled`, `community.leaderboard.enabled`, and social profile visibility can be toggled independently in Admin `/config`. When social is closed, a student's own achievements and level progress remain accessible on `/profil`.

---

## 2. Core Subsystems & Current Rules

### 2.1 Shared Study Rooms (`/topluluk/oda/[id]` & `/seans`, `/v1/study-rooms/*`)
- **Top-Down Illustrated Tables (`.room-stage`):** Students sit together around a top-down illustrated table in `LIBRARY`, `CAFE`, or `HOME` themes (see [`room-theme-visual-prompts.md`](./room-theme-visual-prompts.md)).
- **Session Labeling, Not a Second Timer:** Joining a room (`MASA-` invite code or public room list) binds the student's active `/seans` focus session to the shared table so seatmates see live focus status without chat distraction.

### 2.2 Effort-Only League (`/topluluk/lig`, `GET /v1/community/leaderboard`)
- **Windows:** `weekly` (default, resets Monday `00:00` `Europe/Istanbul`), `today`, and `all_time`.
- **No-Shame Design (`DESIGN.md` §11):** `league-you-card.tsx` highlights the student's rank, XP counter, and upward movement (`"Yükseldi"`), never calling out downward drops on the personal hero card. `league-list.tsx` shows top 3 medals and pins the viewer's own `"Sen"` row when outside the top 10.

### 2.3 12 Journey Levels & Achievements ("Işık Yandı")
- **12 Energetic Level Titles (`journey_levels`):**
  - `Başlangıç`: `Civciv` · `Çaylak` · `Meraklı`
  - `Tempo`: `Yavru Baykuş` · `Gece Gözcüsü` · `Durdurulamaz`
  - `Ustalık`: `Bilge Baykuş` · `Eski Kurt` · `Kaptan`
  - `Zirve`: `Şampiyon` · `Fenomen` · `Efsane`
- **12 Core Achievements (`achievements.json`):** `İlk Seans Tamam!`, `Plan Hazır`, `Hayal Panon Açıldı`, `Bir Hafta Tam!`, `Bir Ay Tam!`, `Geri Döndün!`, `Plan Tazelendi`, `İlk Deneme Kayıtta`, `Yanlışa Rövanş`, `Haftanı Okudun`, `Selam Topluluk!`, `Günü Kurtardın!`, plus 4 community badges (`Maratoncu`, `Gece Kuşu`, `Moral Kaynağı`, `Yeni Komşu`).
- **Auto-Playing Ceremonies (`AchievementCelebration` & `JourneySpotlightScene`):**
  - Queued via `CelebrationOverlayProvider` (`NotificationDrawerShell`) so level/achievement ceremonies play *before* the panel mood check-in or promotion dialog opens.
  - "Işık Yandı" auto-ignites 1.5s after the orb forms, reveals the 3D/SVG badge with Web Audio synth SFX, and flies home to `[data-achievement-home]` on close (`Escape` or `"Devam edelim"`), restoring keyboard focus to the opener.

### 2.4 Study Buddy (`/v1/buddy/*`)
- 1-on-1 study partner matching within the same exam cohort (`requests/:username`, `accept`, `nudge` with 4h cooldown, `study-invite`, and live `partnerStudyingNow` indicator).

---

## 3. API Surface

| Endpoint | Purpose |
|---|---|
| `GET /v1/community/summary` | Self streak, badges, achievements, and (when economy on) XP, level, and league rank |
| `GET /v1/community/leaderboard?window=weekly\|today\|all_time` | Cohort-scoped XP effort league (`community.leaderboard.enabled`) |
| `GET /v1/community/profile/:username` | Public member profile header, badges, and level (visitor 3rd-person copy) |
| `GET\|POST /v1/study-rooms`, `POST /v1/study-rooms/join` | List/create study rooms or join by `MASA-` code |
| `GET\|PATCH\|DELETE /v1/study-rooms/:id`, `POST .../:id/code` | Room detail, owner settings, close room, or rotate invite code |
| `DELETE /v1/study-rooms/:id/members/{me,:userId}` | Leave room or remove member (owner) |
| `GET\|DELETE /v1/buddy`, `GET /v1/buddy/suggestions` | Active study buddy view, end pairing, or cohort suggestions |
| `POST /v1/buddy/requests/:username`, `POST\|DELETE .../requests/:id*` | Send, accept, or decline buddy request |
| `POST /v1/buddy/{nudge,study-invite}` | Send 4h-throttled study nudge or table invite |

---

## 4. Geliştirmeler (Condensed Milestone Timeline)

- **2026-11-04 — Energetic Puhu Voice for Levels & Achievements (`APP-136`):** Updated all 12 level names (`Civciv` → `Efsane`), 12 achievement titles/celebrations (`İlk Seans Tamam!`, etc.), and 4 community badges to the energetic Duolingo-like Puhu register.
- **2026-10-30 — Own Progress Under Social Closure:** Allowed students to view their own achievements and level progression on `/profil` even when public social/community switches are off.
- **2026-10-07..08 — Weekly League (`/topluluk/lig`) & Visitor Profile Cards:** Redesigned `/topluluk/lig` (`league-you-card.tsx`, `league-list.tsx`, Istanbul reset counter), added 3rd-person visitor copy on `/topluluk/uye/[username]`, and removed dead legacy effort-board components.
- **2026-10-01 — "Işık Yandı" Auto-Play Achievement Ceremony:** Shipped `components/achievements/scene/*` with auto-ignition, spark origin tracking (`last-pointer.ts`), flight-to-avatar exit, and `/dev/basari-sahnesi` preview harness.
- **2026-08-25..09-14 — Shared Study Rooms, Spotlight Ladder & Celebration Queue:** Shipped `/v1/study-rooms` (`LIBRARY`/`CAFE`/`HOME` top-down tables), interactive 12-tier `JourneySpotlightScene` with focus restoration, and `CelebrationOverlayProvider` modal sequencing.
- **2026-07-25..08-15 — Community Summary, Badges & Study Buddy (`APP-018–APP-022`):** Built `CommunityModule`, derived positive badges, and 1-on-1 `/v1/buddy` pairing.
