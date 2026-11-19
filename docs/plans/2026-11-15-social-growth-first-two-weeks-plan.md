# Social growth, first two weeks: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the two weeks after the launch kit's calendar ends (2026-11-25 → 2026-12-08) with a
waitlist campaign, two useful carousels, an ambassador pack, dated Metricool drafts and a weekly report.

**Architecture:** New visuals are new pieces in the existing Remotion kit (`marketing/social`), following
its pattern: id in `pieces.ts`, on-image text in `copy.ts`, post text in `captions.ts`, component in
`src/pieces/`, registered in `Root.tsx`. Everything else is Markdown under `marketing/social/` plus
Metricool drafts and one scheduled task. No app code changes.

**Tech Stack:** Remotion 4.0.541, React 19, TypeScript, vitest; Metricool connector; scheduled tasks.

**Spec:** `docs/plans/2026-11-15-social-growth-strategy-design.md`

## Global Constraints

- Copy: at most one "!" per sentence, no em dash, "yapay zekâ" never "AI", no "Son şans" / "Kaçırma",
  never mock failure or low scores, never explain invite-only access or KVKK in a post.
- Brand: "PuhuKoç" in running text, `@puhukoc`, `puhukoc.com`. Exams, when listed: `KPSS · YKS · LGS · ALES · DGS`.
- No price anywhere. No exam date in any post (ÖSYM's 2027 calendar is not confirmed on osym.gov.tr).
- Story safe zones: nothing readable in the top 250 px or the bottom 250 px. Links are native stickers
  only; the image leaves a dashed guide that renders only in Studio.
- No paid ads. Nothing is published without the owner's approval per post: Metricool entries are drafts.
- The owner commits. Do not commit, push or open a PR; end each task by listing the changed files.
- Run kit commands from `marketing/social`.

## Review Focus

1. Turkish capitals and diacritics (İ, Ş, Ğ, â) clipped by tight line-height in the new big headlines:
   open every rendered PNG at full size (Task 1 step 7, Task 2 step 7).
2. A long word wrapping a carousel headline onto a third line: length test in Task 1.
3. Story text or the sticker guide under Instagram's UI: Studio check with the safe overlay in Task 2 step 6.
4. A Metricool entry created as a live scheduled post instead of a draft: read-back check in Task 4 step 4.
5. The Monday report silently showing zeros when Metricool returns nothing: the task prompt in Task 5
   must say "veri gelmedi" instead of printing numbers.

---

### Task 1: "İşe yarar" carousels K1 and K2

**Files:**
- Create: `src/components/Tip.tsx`, `src/pieces/K.tsx`, `test/tip.test.ts`
- Modify: `src/pieces.ts`, `src/copy.ts`, `src/captions.ts`, `src/Root.tsx`, `test/pieces.test.ts`,
  `test/captions-complete.test.ts`, `README.md`

**Interfaces:**
- Produces: `PieceId` gains `"K1" | "K2"`; `PIECES` gains
  `{ id: "K1", format: "feed", title: "İşe yarar · Denemeden sonraki 20 dakika", cards: 5 }` and
  `{ id: "K2", format: "feed", title: "İşe yarar · Tutan bir haftalık plan", cards: 5 }`, appended after `IR1`.
- Produces: `TipCard(props: { copy: Record<string, string>; card: number; safe: boolean }): JSX.Element`
  and `TIP_LIMITS = { head: 30, body: 80 }` from `src/components/Tip.tsx`.

Copy (`COPY.K1`, `COPY.K2`; flat keys, shared `tag: "İŞE YARAR"`, `footer: "puhukoc.com · @puhukoc"`):

| Key | K1 | K2 |
|---|---|---|
| `c1Head` | Denemeden sonraki 20 dakika. | Tutan bir haftalık plan. |
| `c1Body` | Neti asıl burada artırırsın. | 4 adım, 10 dakika. |
| `c1Note` | kaydet, lazım olacak. | pazar akşamı yap. |
| `c2Head` | Yanlışları üçe ayır. | Önce sabitleri yaz. |
| `c2Body` | Bilmiyordum. İşlem hatası yaptım. Süre yetmedi. | Okul, kurs, yemek, uyku. Kalanı senin çalışma alanın. |
| `c3Head` | Her yanlışa tek cümle yaz. | Güne en çok 3 ana iş. |
| `c3Body` | Neden yanlış yaptım? Cevap bir cümleyi geçmesin. | Dördüncüyü yazarsan üçü de yarım kalır. |
| `c4Head` | Bilmediklerini haftana koy. | Her güne 20 dakika tekrar. |
| `c4Body` | En çok yanlış çıkan iki konu, haftanın ilk işi. | Dünün yanlışları, bugünün ilk işi. |
| `c5Head` | Bir hafta sonra tekrar çöz. | Bir günü boş bırak. |
| `c5Body` | Aynı sorular, kitap kapalı. Çözüyorsan konu senin. | Aksayan işler oraya kayar, plan bozulmaz. |
| `c5Note` | Puhu’da bunun adı Yanlış Defterim. | üşenirsen Puhu kursun. |

Captions: K1 `text` "Deneme bitti, asıl iş şimdi başlıyor. 📝\nBu dört adımı kaydet, sıradaki denemeden sonra aç."
K2 `text` "Pazar akşamı 10 dakika ayır, hafta kendini toplasın. 🗓️\nKaydet, pazar günü lazım olacak."
Both use `tags: SERIES_TAGS`; `alt` is an array of five sentences, one per card, each naming the
headline on that card.

- [ ] **Step 1: Write the failing tests.** In `test/pieces.test.ts` append `"K1", "K2"` to the expected
  id list. In `test/captions-complete.test.ts` replace the `F4` special case with
  `if (p.cards) expect(c!.alt, p.id).toHaveLength(p.cards)`. Create `test/tip.test.ts`:

```ts
import { expect, it } from "vitest";
import { TIP_LIMITS } from "../src/components/Tip";
import { COPY } from "../src/copy";

const KEYS = ["tag", "footer", "c1Head", "c1Body", "c1Note", "c2Head", "c2Body", "c3Head", "c3Body", "c4Head", "c4Body", "c5Head", "c5Body", "c5Note"];

it.each(["K1", "K2"] as const)("%s has every card's copy within the layout limits", (id) => {
  const copy = COPY[id]!;
  expect(Object.keys(copy).sort()).toEqual([...KEYS].sort());
  for (const n of [1, 2, 3, 4, 5]) {
    expect(copy[`c${n}Head`]!.length, `c${n}Head`).toBeLessThanOrEqual(TIP_LIMITS.head);
    expect(copy[`c${n}Body`]!.length, `c${n}Body`).toBeLessThanOrEqual(TIP_LIMITS.body);
  }
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL (`K1` missing from `PIECES`, `Tip` module not found).
- [ ] **Step 3: Add the ids, pieces, copy and captions** exactly as listed above.
- [ ] **Step 4: Implement `TipCard` in `src/components/Tip.tsx`.** Direction C (krem defter): `Frame`
  `format="feed"` with `DOT_PAPER` from `src/pieces/F2.tsx`. Top row: `tag` in the yellow rotated pill
  used by F3's badge, and "n/5" at the right (28 px, weight 900, `C.inkBlue`). Card 1: headline 126 px
  weight 1000 in `C.navy`, body in `C.blue` at 64 px, Caveat note 62 px rotated -3°, `ART.p3` peeking from
  the bottom edge as in F2. Cards 2–5: step number (card − 1) in a 132 px `C.blue` circle with white
  numerals, headline 104 px `C.navy`, body 46 px weight 800 `C.navy`. Card 5 adds the Caveat note,
  `ART.wave` at bottom right, and `Logo` + `footer` at bottom left as in F2. Line-height 1.02 minimum.
- [ ] **Step 5: Implement `K1` and `K2` in `src/pieces/K.tsx`** (`({ card = 1, safe }: PieceProps) =>
  <TipCard copy={COPY.K1!} card={card} safe={safe} />`) and add both to `COMPONENTS` in `src/Root.tsx`.
- [ ] **Step 6: Run `npm test` and `npm run typecheck`.** Expected: all pass, typecheck clean.
- [ ] **Step 7: Run `npm run render -- --only K1,K2`.** Expected: ten PNGs in `out/K1` and `out/K2`.
  Open each one: no clipped diacritics, no headline on three lines, nothing overlapping Puhu.
- [ ] **Step 8: Add one README line** under "Edit": carousels are `TipCard` + `COPY.K<n>`, limits in `TIP_LIMITS`.
- [ ] **Step 9: Send the ten PNGs to the owner for review and list the changed files.**

### Task 2: Waitlist series WS1, WS2, WS3 and reel WR1

**Files:**
- Create: `src/pieces/WS.tsx`, `src/pieces/WR1.tsx`
- Modify: `src/pieces.ts`, `src/copy.ts`, `src/captions.ts`, `src/Root.tsx`, `src/components/LinkGuide.tsx`,
  `test/pieces.test.ts`, `README.md`

**Interfaces:**
- Consumes: Task 1's `PIECES` order (append after `K2`).
- Produces: ids `"WS1" | "WS2" | "WS3" | "WR1"`; `WR1` video
  `{ fps: 30, durationInFrames: 240, endCardFrom: 180, coverFrame: 150 }`;
  `LinkGuide` gains an optional `label?: string` (default: its current text).

| Piece | Direction | On-image copy | Art | Sticker guide |
|---|---|---|---|---|
| WS1 | B · gece | `head` "Işık yandı." · `punch` "Yerin hazır!" | `ART.w2` full-bleed, `objectPosition: "50% 42%"`, night gradient from y 1100 down | link, y 1500 |
| WS2 | A · mavi | `head` "Açılınca" · `punch` "ilk işin ne?" · `hint` "ankete bas, Puhu sayıyor." (Caveat) | `ART.host` at left, starts y ≥ 760 | `label` "Anket çıkartması buraya", y 1180 |
| WS3 | C · krem | `exams` "KPSS · YKS · LGS · ALES · DGS" · `head` "Hepsi aynı masada." · `punch` "Bir sandalye de sana." | `ART.masa` full width at y 1000, `ART.p3` peeking at the bottom | link, y 780 |
| WR1 | B · gece | `hook1` "Bir pencere" · `hook2` "hâlâ karanlık." · `head` "Işığı yak." · `punch` "Yerin hazır!" | `ART.w2` under a `C.night` overlay | none |

WR1 beats (one beat = 15 frames): 0 hook over the dark window (overlay opacity 0.86); 45 the light
snaps on (overlay to 0 in 6 frames, one `shake`); 60 `head` slams; 75 `punch` pops in `C.yellow`;
180 `EndCard` with `puhu="wave"`, no tag.

Captions: WS1 "Işık yandı, Puhu bekliyor. 🔦\nYerini kap: puhukoc.com" · WS2 "Açılınca ilk işin ne
olacak? Ankete bas. 👀" · WS3 "KPSS, YKS, LGS, ALES, DGS: hepsi aynı masada. 🪑\nBir sandalye de
sana: puhukoc.com" · WR1 "Bir pencere hâlâ karanlık: seninki. 🌙\nIşığı yak, yerin hazır: puhukoc.com".
Each gets one alt sentence describing the image.

- [ ] **Step 1: Write the failing tests.** In `test/pieces.test.ts` append `"WS1", "WS2", "WS3", "WR1"`
  to the id list and add:

```ts
it("pins the waitlist reel at 8 s = 16 beats", () => {
  expect(byId("WR1").video).toEqual({ fps: 30, durationInFrames: 240, endCardFrom: 180, coverFrame: 150 });
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL on the id list and `WR1`.
- [ ] **Step 3: Add ids, pieces, copy and captions** as in the table.
- [ ] **Step 4: Implement `WS1`, `WS2`, `WS3` in `src/pieces/WS.tsx`** with `Frame format="story"`, the
  logo at y 258, headlines between y 300 and y 700, and the guide wrapped in `guides ? … : null` as in
  `src/pieces/S3.tsx`. Add the `label` prop to `LinkGuide`.
- [ ] **Step 5: Implement `WR1` in `src/pieces/WR1.tsx`** using `pop`, `slam`, `shake` from `src/motion.ts`
  and the `EndCard` pattern from `src/pieces/IR1.tsx`; register all four in `src/Root.tsx`.
- [ ] **Step 6: Run `npm test`, `npm run typecheck`, then `npm run studio`** and view WS1–WS3 with the
  `safe` prop on. Expected: no text or guide inside the top or bottom 250 px band.
- [ ] **Step 7: Run `npm run render -- --only WS1,WS2,WS3,WR1`.** Open the three PNGs, the MP4 and its
  cover: no guide visible, light-on lands on frame 45, end card holds 2 s.
- [ ] **Step 8: Add the four ids to the README's first paragraph, send the renders to the owner, list changed files.**

### Task 3: Ambassador pack

**Files:**
- Create: `marketing/social/ambassadors/README.md`, `ilk-masa-mesaj.md`, `elci-mesaj.md`, `brief.md`,
  and `marketing/social/test/ambassador-copy.test.ts`

- [ ] **Step 1: Write the failing test.** It reads the three message files, strips Markdown headings,
  and asserts `checkCopy(text)` is `[]` for each, `ilk-masa-mesaj.md` and `elci-mesaj.md` are at most
  700 characters, and `elci-mesaj.md` and `brief.md` contain "işbirliği".
- [ ] **Step 2: Run `npm test`.** Expected: FAIL (files missing).
- [ ] **Step 3: Write `README.md`:** the two rings from the spec; Ring 2 criteria (18+, 2.000–30.000
  followers, study or exam content, comments from real students on the last five posts, no betting or
  adult sponsors); the process (owner sends, owner issues the invite link, Claude tracks); a tracking
  table with columns Hesap, Platform, Takipçi, Durum, Davet tarihi, Video, Not. No real names are
  committed: the table ships empty.
- [ ] **Step 4: Write `ilk-masa-mesaj.md`** (Turkish, friend-to-friend, from the owner): what PuhuKoç is
  in one sentence, "ilk masaya seni de çağırıyorum", what they get (early access now, Premium at
  launch), the one ask (use it for a week and tell me what broke), no posting obligation.
- [ ] **Step 5: Write `elci-mesaj.md`** (Turkish DM to a stranger): one sentence on why their account
  fits, what PuhuKoç is, the offer (early access, a named place in the launch, Premium at launch), the
  ask (one honest video after a week), that it is labelled as an işbirliği, and an easy "no".
- [ ] **Step 6: Write `brief.md`:** three things worth showing (odak seansı ve masa, Yanlış Defterim,
  haftalık lakap kartı); claims to avoid (score or rank promises, "bildirimleri engeller", prices,
  exam dates); the işbirliği label; `@puhukoc` tag; no script.
- [ ] **Step 7: Run `npm test`.** Expected: PASS. List the changed files.

### Task 4: Two-week calendar and Metricool drafts

**Files:**
- Create: `marketing/social/calendar/2026-11-25.md`

**Interfaces:**
- Consumes: rendered files in `out/<id>/` and `caption.txt` from Tasks 1–2 and the existing kit.

Calendar (all 19:00 Europe/Istanbul; stories 20:00; reels go to Instagram, Facebook, TikTok and
YouTube Shorts once the channel is connected; feed posts to Instagram and Facebook):

| Date | Piece | Format |
|---|---|---|
| Wed 25 Nov | F3 (pin it) | feed |
| Thu 26 Nov | IR1 | reel |
| Fri 27 Nov | IF3 · WS1 | feed · story |
| Sat 28 Nov | K1 | carousel |
| Sun 29 Nov | WR1 | reel |
| Mon 30 Nov | IS1 | story |
| Tue 1 Dec | IF2 | feed |
| Wed 2 Dec | Puhu clip 1 (fallback T1P) | reel |
| Thu 3 Dec | WS2 | story with poll |
| Fri 4 Dec | IF6 | feed |
| Sat 5 Dec | K2 | carousel |
| Sun 6 Dec | Puhu clip 2 (fallback IS5 as a story) | reel |
| Mon 7 Dec | WS3 | story |
| Tue 8 Dec | IF4 | feed |

- [ ] **Step 1: Write `calendar/2026-11-25.md`** with the table above plus, per row, the caption source
  (`out/<id>/caption.txt`) and the networks. Add the bio links the owner sets by hand:
  `https://puhukoc.com/kayit?utm_source=<instagram|tiktok|youtube|facebook>&utm_medium=social&utm_campaign=yerini-kap&utm_content=bio`.
- [ ] **Step 2: Ask Metricool for the best posting hours** per network for this brand (id 7993018). If
  a network's best hour differs from 19:00 by two hours or more, change that network's rows and note it.
- [ ] **Step 3: Create one Metricool draft per row** (draft flag on, auto-publish off for stories as in
  the existing entries), with the caption text, hashtags and alt text from `caption.txt`. If the
  connector cannot take a local file, stop and hand the owner the list of files to drop into each
  draft; do not host the media anywhere else.
- [ ] **Step 4: Read the planner back** for 2026-11-25 → 2026-12-08. Expected: 15 new entries, every
  one a draft. Any entry that is not a draft is fixed before reporting.
- [ ] **Step 5: Report the 15 drafts to the owner** with dates; the owner approves each in Metricool.

### Task 5: Monday report

**Files:**
- Create: `marketing/social/reports/README.md` (one paragraph: what the report is, where it lands)

- [ ] **Step 1: Create a scheduled task**, weekly, Monday 09:00 Europe/Istanbul, with this prompt:
  "PuhuKoç haftalık sosyal medya raporu. Metricool markası 7993018 için son 7 günün gönderilerini
  çek (ağ, tarih, biçim, gösterim, etkileşim). `marketing/social/reports/<bugünün tarihi>.md`
  dosyasına yaz: ağ bazında toplamlar ve önceki haftaya göre fark; en iyi üç ve en zayıf üç gönderi;
  hesabın ortancasını iki kez geçen biçimler 'tekrarla', üç kez altında kalanlar 'bırak' listesinde;
  önümüzdeki hafta için üç somut öneri. Metricool veri döndürmezse sayı yazma, 'veri gelmedi' yaz ve
  nedenini belirt. Hiçbir gönderiyi yayınlama, planlama ya da değiştirme."
- [ ] **Step 2: Run the task once by hand.** Expected: a report file dated today listing the posts
  published since 2026-11-11, or the "veri gelmedi" line with a reason.
- [ ] **Step 3: Write `reports/README.md`** and list the changed files.

### Task 6: "Puhu oynuyor" clip prompts

**Files:**
- Modify: `marketing/social/PROMPTS.md` (new section 8 at the end)

- [ ] **Step 1: Add section "8 · Puhu oynuyor (kısa yerli videolar)"** with four 5-second clips in the
  same structure as section 6 (start-frame reference, second-by-second choreography, one gag, a clear
  end pose, locked camera, the take checklist). Motion is snappy and exaggerated. No brand names in
  any prompt. Clips: (A) Puhu slaps a ringing alarm clock and points at the viewer; (B) Puhu snatches
  a phone from the frame edge and hides it behind its back; (C) Puhu pulls out an empty chair and pats
  the seat; (D) Puhu holds up a paper reading "+3", then a victory spin. On-screen text is added in
  the kit later, never asked from the image model.
- [ ] **Step 2: Check the section against the copy rules** by eye (the prompts are English; the four
  Turkish hook lines suggested under each clip must pass `checkCopy`). List the changed file.

---

## Owner actions (not agent tasks)

1. Set the four bio links from Task 4 step 1 and pin F3 after it is posted.
2. Open the YouTube channel and connect it to Metricool.
3. Confirm the Metricool plan keeps drafts and analytics available.
4. List Ring 1 (friends) and send `ilk-masa-mesaj.md`; issue their invite links.
5. Check the Google Play account type for the closed-test requirement.
6. Generate clips A–D from PROMPTS.md section 8 when there is time; the calendar has fallbacks.

## Not in this plan

Store listing copy and screenshots (belongs to the mobile release work), launch-week pieces and the
waitlist launch email (Phase 2), paid tests (Phase 3), an admin "grant Premium" action, the
twice-weekly trend check (starts once clips A–D show the owner can turn a clip around in a few days).
