# Voice & tone — Mentor

> Product personality: [`PRODUCT.md`](../../PRODUCT.md) (Warm · Encouraging · Steady).
> This file is the **copy constitution** for student-facing copy: notifications, email, push,
> ritual toasts, coach chrome, onboarding, paywall, empty states, and API errors. Agent and human
> writers read it before adding a template. AI system prompts follow the same two narrators.

## Dual register

One product, two narrators. Pick **before** writing; never mix in the same message.

| Register | Speaks when | Feels like | Emoji |
|---|---|---|---|
| **Puhu** | Celebration, empty inbox, first-visit empty (plan, community, analysis, notebook, session, study room, buddy, vision card, achievements), daily invite, economy invite overlay (eyebrow/headline), streak milestone, “remind me tomorrow”, task-done toast, empty coach chat, FAB nudge, onboarding slides/greeting, paywall delight headlines, weekly recap host | A lively companion nearby. First-person plural (“we”). The mascot is felt, not named on every line. | At most one |
| **Companion** | Coach chat (LLM + rule fallbacks), mood check-in, low mood, streak broken, notebook review, payment, official/admin broadcast, form/API errors, filter/search empty, rights ledger, quest cards (title/badge) and ledger quest lines, knowledge/calendar empty, invite conversion condition (`invite_subtitle`, `redeem_pending`) | Unnamed, calm, “I’m here.” Invitation, never a scold. | None in ritual copy; LLM: at most one, and only in a light moment |

Distress / crisis copy (`coaching.mood.SERIOUS_DISTRESS`, 112) is **untouchable** — do not rewrite for wit.

## Coach chat vs chrome

- **Coach chat (LLM + mood/motivation/nextAction/calibration fallbacks)** uses the **companion** register. First person: “Ben buradayım.” Address the student as **sen**. Short sentences. No guilt. Same mouth as a serious mood reply.
- **Puhu stays in chrome only:** empty-chat prompt, first-visit empty states, FAB nudge, onboarding slides and “Merhaba {name}”, paywall delight headlines, weekly recap host, economy invite overlay eyebrow/headline. Do not let the chat model invent a third character.
- **Filter/search empty, the rights ledger, quest cards, knowledge/calendar gaps, and API errors (`errors.json`) are companion.** Short, sen, no jokes. Payment and official facts stay companion. Admin operator UI is out of this constitution.
- **The LLM must not sign as Puhu.** No bird jokes, wings, mascot name, or “we’re Puhu” in generated chat, mood reflection, daily greeting, session reflection, ghost narration, vision notes, or plan-draft prose. Weekly recap narration is the exception (Puhu host, chrome).

## Rules

- Address the student as **sen**. Formal *siz* is banned (including forum “sorunuza”).
- Title: one short line (~40 characters). Body: at most two sentences.
- Concrete action or emotional company — never “işleminiz gerçekleştirildi”.
- English is the same voice, not a SaaS calque of the Turkish.
- Official exam facts, KVKK, and payment truth stay companion register. **No jokes.**

## Banned

- Ranking shame, loss-aversion (“serin gitti, herkes senden önde”)
- Crying-mascot guilt, exclamation storms
- Corporate “lütfen kontrol ediniz”
- Ranking / bottom-of-the-list language
- Paraphrasing official dates (guardrail §4)

## Before → after

| Before | After | Register |
|---|---|---|
| Seriniz sıfırlandı / …sona erdi. Bugün yeniden başlayabilirsin! | Yarın yine seninle / Seri durdu, yol durmadı. Bugün küçük bir adım yeter. | Companion |
| Sorunuza cevap geldi / Sorduğun soruya yeni bir cevap yazıldı. | Cevabın geldi / Sorduğun şeye biri el uzattı. | Puhu |
| Henüz bildirim yok / Planına başladığında burada görürsün | Puhu henüz fısıldamadı / Bugün bir adım atınca burası uyanır. | Puhu |
| Bugüne henüz görev eklemedin. Küçük bir adım bile yeterli. | Bugün henüz bir iz yok. Küçük bir görevle burası uyanır. | Puhu |
| Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin. | Bir şey ters gitti. Biraz sonra bir daha deneyelim. | Companion |
| Ödeme işlemin tamamlanamadı. Lütfen abonelik ayarlarını kontrol et. | Ödeme tamamlanamadı / Premium’un durmasın diye ayarlardan bir bakman yeterli. | Companion |
| Gönderinize yorum yapıldı | Yorumun var / Paylaşımına birinin sözü düştü. | Puhu |
| Sizden bahsedildi | Adın geçti / Bir gönderide senden bahsedildi. | Puhu |
| Yeni bir başarı kazandın / {title} artık başarı koleksiyonunda. | Yeni bir ışık yandı / {title} artık seninle. | Puhu |
| Görev tamamlandı. | Bu da tamam. | Puhu |
| Yarın seni nazikçe hatırlatacağız. | Yarın nazikçe yanına uğrarız. | Puhu |
| Henüz seans yok. İlk seansını başlat. | Henüz bir seans izi yok. İlk odakla burası uyanır. | Puhu |
| Henüz hareket yok. | Henüz bir hareket düşmedi. | Companion |
| Bu sınav için makaleler yakında eklenecek. | Bu sınav için doğrulanmış makale henüz yok. | Companion |
| Lütfen tekrar dene. / Kaydedilemedi. | Biraz sonra bir daha deneyelim. / Şimdi kaydolmadı. | Companion |
| Henüz bir şey kaydetmedin. | Henüz bir iz yok. Kaydedince burada durur. | Puhu |
| Arkadaşını davet et, ödül kazan! | Birini yanına al. Yol yalnız gitmesin. | Puhu |
| İkiniz de kazanırsınız / Ödül hesabına yansır | Kayıt olup aktif olunca ikinize de hak düşer. | Companion |
| Davet ödülü / Görev ödülü | Davet hakkı / Görev hakkı | Companion |

## Where copy lives

- In-app / push templates: `apps/api/src/i18n/locales/{tr,en}/notifications.json`
- Achievement inbox lines: `apps/api/src/i18n/locales/{tr,en}/achievements.json` (`notification.*`)
- Email subjects/bodies: `notifications.json` → `email.*` (HTML skeleton stays in the Postmark adapter)
- Coach fallbacks: `apps/api/src/i18n/locales/{tr,en}/coaching.json` (`mood.*` except `SERIOUS_DISTRESS`, `motivation.*`, `nextAction.*`, `mentorV2.calibration`)
- AI chat persona: `mentor-v2-prompt.ts` (V2) and `coachSystemBase` in `ai.constants.ts` (V1)
- Web chrome: `apps/web/messages/{tr,en}.json` (coach, plan/community/analysis/notebook, session, study room, economy ledger empty + invite overlay, knowledge, vision, achievements empties)
- API errors: `apps/api/src/i18n/locales/{tr,en}/errors.json` (student keys; leave `ADMIN_*` for operators)
- Ledger row labels: `apps/api/src/i18n/locales/{tr,en}/economy.json` (`ledger.*`; companion, hak not ödül)
- Quest card titles, badges, and ledger quest lines: `economy.json` (`quests.*`; companion. `{target}` resolves on the card; ledger strips `{target}`. `{days}`/`{count}` come from the quest id.)
- Admin broadcasts: free text; the announcements form offers companion-register examples

Do not hardcode student-facing sentences in listeners or ledger mappers. Resolve through `NotificationsCopyService`
(or `NotificationsService.createFromTemplate`) and store `data.templateKey` + `data.args` so the
inbox can re-localize on read. Ledger titles and quest card copy resolve through `economy.json` on read (`Accept-Language`).

## Out of this constitution’s product chrome

Admin operator UI. Same dual register; do not invent a third narrator.
