# Coin or Premium unlock choice (pilot: weekly recap)

Date: 2026-11-03. Status: weekly recap pilot implemented 2026-11-03 (uncommitted): API teaser +
email gate removed, `components/unlock-choice.tsx`, new access card. Other Coin sinks: later rounds.
Canvas: https://claude.ai/artifact/XdpdqUwQUJPpE7dCebptix (direction B, all states, plan draft reuse).

## Why

The weekly recap access card (`analysis/recap/_components/weekly-recap-access-card.tsx`) shows the
backend policy badly, though the policy itself is sound (`docs/plans/2026-11-01-weekly-recap-access-design.md`):

- Neither the price (250 Coin) nor the balance is shown. "Kalan Coin hakkın: 2/2" reads as "you have
  2 Coin"; it is the rolling 30-day allowance.
- The best path (verify email, first story free) is a small link; the loudest button is
  "Teklifi yenile", which only refetches the offer and means nothing to a student.
- Coin and Premium are not presented as a choice: three equal buttons, no recommendation.
- Nothing says how Coin is earned when it falls short (+10 per active day, +100 at 5 active days).
- Nothing shows what is inside the story. Dates print as ISO (2026-10-19).

The other Coin sinks (plan draft dialog, notebook capacity, streak freeze) each use their own layout.

## Owner decisions (2026-11-03, all recommended options)

1. Scope: one shared pattern for every Coin sink, coded on the weekly recap first; plan draft,
   notebook capacity and streak freeze adopt it in later rounds. Coach chat is out: no Coin amounts
   in the AI chat zone (AGENTS.md §4 #3).
2. Preview: the week's real numbers on the locked card (active days, focus minutes, top subject).
   They are free basic statistics and deterministic; the product sold is the story and Puhu's note.
3. When Coin falls short or the 30-day allowance is used: Premium leads (trial ledge when eligible),
   the Coin row shows drawn progress, what is missing and how Coin accrues.
4. Coin confirmation: inline. The Coin row expands to "Bakiyen 320 → 70 Coin", one confirm ledge
   and "Vazgeç". No dialog, no button that silently changes its label.
5. Direction B, "Hikâye kapağı": the card's top is the story's own cover in the scoped recap
   palette (`.weekly-recap-theme`, coral, big numbers, Puhu); the shared choice sits under it.
6. Voice: the card speaks energetic Puhu (Duolingo-like); money stays plain (price, balance,
   confirm, payment ledges, what was or was not spent, errors). Recorded in `docs/copy/voice.md`.
7. The first free story no longer needs a verified email. A READY week already takes a week of
   real activity per account, Google sign-ins are verified anyway, one narration is cheap and the
   global AI budget guard caps spend, and email verification has its own Coin quest. Backend:
   drop `me.emailVerified` from the earned check in `weekly-recap-policy.service.ts` and retire
   `WEEKLY_RECAP_EMAIL_REQUIRED` (error code, i18n, tests).

## The pattern: "Açma seçimi" (unlock choice)

- Up to three rows, hairline-separated, no nested cards:
  **Hediye** (gift glyph), **Premium** (title + PREMIUM badge + one-line benefit),
  **Coin** (Coins glyph + "250 Coin ile bu hafta" + count on the title line).
- A heading ("Hangi yoldan açalım?") over the rows.
- Exactly one filled ledge, under the row that leads. The other row gets a text link
  (`PANEL_TEXT_LINK`). The leading row comes first.
- Coin row parts: a 12 px play progress bar (balance against cost) when short; allowance pips
  ("30 günde 2 hikâye: 2 hakkın duruyor") when the sink has a rolling limit; "Coin nasıl birikir"
  links to the profile economy section.
- A footnote under the rows: what stays yours ("Açtığın hikâye arşivinde kalır. Tekrar izlemek
  Coin harcamaz.").
- Web purchases off (`availability.studentPurchases` false): the Premium row is not drawn. Coin
  leads when affordable; otherwise no ledge, only the Coin row and its link.

## States (offer → what the student sees)

| Offer | Leading row / ledge | Other content |
|---|---|---|
| `EARNED` | Hediye: "Hediyemi aç" | "Sonraki haftalar Coin ya da Premium ile açılır." |
| `COIN`, affordable, allowance left | Coin: "250 Coin ile aç" | Premium row with "Premium'u incele" link |
| Coin armed | Coin row expanded: 320 → 70, "Onayla ve aç", "Vazgeç" | Premium row hidden |
| `INSUFFICIENT_COIN` | Premium: "7 gün ücretsiz dene" / "Premium'u incele" | Coin row: 80/250 bar, "170 Coin daha, hikâye senin!" |
| `WEEKLY_RECAP_LIMIT_REACHED` | Premium ledge | Coin row: empty pips, "İki hikâyeyi de açtın, harika! Sıradaki hakkın 12 Kasım'da geliyor." |
| `PREMIUM` | "Haftamı aç" under PREMIUM badge, masked Puhu on the cover | no upsell |
| `OWNED` | "Tekrar izle" | |
| `AI_BUDGET_EXCEEDED`, `AI_DISABLED`, `WEEKLY_RECAP_PROCESSING` | outline "Yeniden dene" | "Coin ya da hak harcanmadı." |

"Teklifi yenile" is removed. The offer refetches when the tab regains focus (Coin earned in
another tab, a subscription bought) and after a failed open.

## Copy

Energetic Puhu for the card: "Haftan hazır! Puhu sana özel bir not da yazdı.", "Hangi yoldan
açalım?", "Her hafta yeni bir hikâye!", "170 Coin daha, hikâye senin! Çalıştığın her gün +10, 5 günde
+100 Coin.", "İlk hikâyen bizden!", "İlk haftanı tamamladın, bu hikâye hediye!". Plain for money:
"Bakiyen 320 → 70 Coin", "Onayla ve aç", "Vazgeç", "7 gün ücretsiz dene", "Coin ya da hak
harcanmadı." (`docs/copy/voice.md` § Açma seçimi). Say what lands: "250 Coin", never "ödül".
Dates as a range ("19–25 Ekim", en dash allowed in numeric ranges).

## Round 2: plan draft ("Koçla planla", 2026-11-03)

Today the price shows only after the four-step wizard (days, minutes, subjects, note), the
balance and the 24-hour allowance never show, and a short balance gets a plain dialog with the
server text ("Görevlerden hak kazanabilir…") and one Premium button. Owner decisions:

1. **Choice first.** Tapping "Koçla planla" on the Coin path opens the choice sheet (`Modal`
   from `@mentor/ui` + `UnlockChoice`) before the wizard. Confirming opens the wizard; no second
   dialog at the end. Coin is still spent only when the draft is saved. If the price changes
   while the student answers, the server refuses with `AI_PLAN_PRICE_CHANGED` and nothing is
   spent; the sheet reopens with the new price.
2. **Exact time when the allowance is used:** the plan offer gains `nextAvailableAt` (oldest
   Coin preview in the rolling 24 hours + 24 h), like the recap offer.
3. **The wizard's last button reminds the price** on the Coin path: "200 Coin ile hazırla".
   Premium keeps "Önizlemeyi hazırla".

| Offer | What the student sees |
|---|---|
| `INCLUDED` (Premium) | Straight to the wizard, as today |
| `NONE` / `PAYMENT_PREMIUM_REQUIRED` | The paywall, as today |
| `COIN`, can generate | Sheet "Planını koçla hazırla": Coin row leads ("200 Coin ile yeni taslak", "Bakiyen 320", one pip), ledge "200 Coin ile hazırla" → inline "320 → 120 Coin", "Onayla ve devam et" → wizard |
| `INSUFFICIENT_COIN` | Premium leads (trial ledge when eligible); Coin row 80/200 bar, "120 Coin daha, taslak senin!", "Coin nasıl birikir" |
| `AI_PLAN_COIN_LIMIT_REACHED` | Premium leads; Coin row "Bugünkü taslağını hazırladın, süper!", "Sıradaki taslak hakkın bugün 21:40'ta geliyor." |
| `AI_DISABLED`, `AI_BUDGET_EXCEEDED` | "Yeniden dene", "Coin harcanmadı." |
| `AI_RATE_LIMITED` (shared daily cap) | The server message, no ledge |

A saved draft stays reachable as "Kayıtlı taslağımı aç" (a text link in the sheet and the
existing button). Default, open to change: a blocked Coin tap now shows the sheet instead of
jumping straight into the saved draft, so a short balance always shows how Coin adds up.

Status: implemented 2026-11-03 (`plan-coin-sheet.tsx`, `plan-coin-view.ts`, `e2e/plan-coin-sheet.spec.ts`). A Coin refusal at submit time reopens the sheet over the wizard, armed with the new price.

## Out of scope

Price and allowance changes (250 Coin, 2 per 30 days stay: a fully active free week brings
~150–170 Coin, so one story ≈ two weeks of effort, matching the allowance). Coach chat. Rewarded ads.
