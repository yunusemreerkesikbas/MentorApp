# Voice & tone — Mentor

> Product personality: [`PRODUCT.md`](../../PRODUCT.md) (Warm · Encouraging · Steady).
> This file is the **copy constitution** for student-facing copy: notifications, email, push,
> ritual toasts, coach chrome, onboarding, paywall, empty states, and API errors. Agent and human
> writers read it before adding a template. AI system prompts follow the same two narrators.

## Dual register

One product, two narrators. Pick **before** writing; never mix in the same message.

| Register | Speaks when | Feels like | Emoji |
|---|---|---|---|
| **Puhu** | Celebration, empty inbox, first-visit empty (plan, community, analysis, notebook, session, study room, buddy, vision card, achievements, weekly effort board), daily invite, economy invite overlay (eyebrow/headline), streak milestone, streak-rescue success overlay, “remind me tomorrow”, task-done toast, quest-complete toast (`quest_reward_*`), empty coach chat, FAB nudge, onboarding slides/greeting, paywall delight headlines, weekly recap host, achievement collection chrome (`how_to_earn`, `earned`, `earned_on`, showcase aria) | A lively companion nearby. First-person plural (“we”). The mascot is felt, not named on every line. | At most one |
| **Companion** | Coach chat (LLM + rule fallbacks), mood check-in, low mood, streak broken, streak-rescue offer/insufficient (`streak_rescue_hint` … `insufficient`), notebook review, payment, official/admin broadcast, form/API errors, filter/search empty, rights ledger, quest cards (title/badge) and ledger quest lines, quest sheet intro (`quests_subtitle`), optional rewarded-ad offer (`ads.rewarded`), knowledge/calendar empty, invite conversion condition (`invite_subtitle`, `redeem_pending`), rank banners and “you’re not on the board yet” (effort, not place), coach access gate (`coach.gate` default/insufficient), deep-analysis insufficient (`analysis.deep.insufficient`) | Unnamed, calm, “I’m here.” Invitation, never a scold. | None in ritual copy; LLM: at most one, and only in a light moment |

Distress / crisis copy (`coaching.mood.SERIOUS_DISTRESS`, 112) is **untouchable** — do not rewrite for wit.

## Coach chat vs chrome

- **Coach chat (LLM + mood/motivation/nextAction/calibration fallbacks)** uses the **companion** register. First person: “Ben buradayım.” Address the student as **sen**. Short sentences. No guilt. Same mouth as a serious mood reply.
- **Puhu stays in chrome only:** empty-chat prompt, first-visit empty states, FAB nudge, onboarding slides and “Merhaba {name}”, paywall delight headlines, weekly recap host, economy invite overlay eyebrow/headline, quest-complete toast, streak-rescue success overlay, achievement collection labels (`how_to_earn`, `earned`, `earned_on`). Collection is a mark/light, not an economy prize — no “kazanıldı / how to earn”. Do not let the chat model invent a third character.
- **Filter/search empty, the rights ledger, quest cards, quest sheet intro (`quests_subtitle`), streak-rescue offer and insufficient-coin copy, optional rewarded-ad offer (`ads.rewarded`), knowledge/calendar gaps, rank banners (effort, not place), coach access gate (`coach.gate` default/insufficient), deep-analysis insufficient (`analysis.deep.insufficient`), and API errors (`errors.json`) are companion.** Short, sen, no jokes. Payment and official facts stay companion. Admin operator UI is out of this constitution. Prize-verb FOMO (“hak kazan”, “earn a right”) stays out of these lines; coin is a non-monetary **hak**. Keep “kazanılmış hak” / “earned right” as the noun for a right already in hand.
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
- Corporate “lütfen kontrol ediniz” and form-command “kontrol et” / “Check the format”
- Ranking / bottom-of-the-list language
- Paraphrasing official dates (guardrail §4)
- Em dash (—) in student copy. Use a period, comma, or colon. Keep the en dash in numeric ranges (2–4).
- AI slop: antithesis openers (“X değil, aslında Y”), stacked “buradayım” as rhythm, filler that sounds generated

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
| Görev tamamlandı / {reward} kazandın | Bu da tamam / {reward} seninle. | Puhu |
| Günlük ritüelini tamamla, XP kazan. | Ritüel bugün burada. Başlangıç adımları tamamlanınca hak düşer. | Companion |
| Yarın seni nazikçe hatırlatacağız. | Yarın nazikçe yanına uğrarız. | Puhu |
| Henüz seans yok. İlk seansını başlat. | Henüz bir seans izi yok. İlk odakla burası uyanır. | Puhu |
| Henüz hareket yok. | Henüz bir hareket düşmedi. | Companion |
| Bu sınav için makaleler yakında eklenecek. | Bu sınav için doğrulanmış makale henüz yok. | Companion |
| Lütfen tekrar dene. / Kaydedilemedi. | Biraz sonra bir daha deneyelim. / Şimdi kaydolmadı. | Companion |
| Henüz bir şey kaydetmedin. | Henüz bir iz yok. Kaydedince burada durur. | Puhu |
| Arkadaşını davet et, ödül kazan! | Birini yanına al. Yol yalnız gitmesin. | Puhu |
| İkiniz de kazanırsınız / Ödül hesabına yansır | Kayıt olup aktif olunca ikinize de hak düşer. | Companion |
| Davet ödülü / Görev ödülü | Davet hakkı / Görev hakkı | Companion |
| Serini kurtaralım mı? / serini kısalttı, geri al | Günü dondur / Dün boş kaldı. Coin ile dondurursan seri yerinde durur. | Companion |
| Serin kurtarıldı! 🔥 | Serin yerinde. / Kaçırılan gün donduruldu. Yol durmadı. | Puhu |
| Reklamı tamamla, Coin kazan / Ödül doğrulanamadı. Lütfen… | Reklamı bitirince Coin hak düşer. / Hak doğrulanamadı. Tekrar deneme… | Companion |
| Sıralamada yerini al / Zirvedesin! / Podyumdasın | Bu hafta henüz bir iz yok. / Bu hafta emeğin yanımızda. | Companion / Puhu |
| Sıralama / Leaderboard (sayfa başlığı) | Emek panosu / Effort board | Companion |
| Koç için hak kazan / Profilden … hakkı kazanabilirsin | Koç için hak / Profilden görev veya davet. Sohbet hakkı orada düşer. | Companion |
| Görev tamamlayarak kazanabilirsin. / Complete quests to earn more. | Görevlerden hak düşebilir. / A right can land from quests. | Companion |
| Nasıl kazanılır? / {title} kazanıldı | Nasıl uyanır? / {title} seninle | Puhu |
| Formatını kontrol et. / Check your inbox. | Kullanıcı adı uymadı. / Gelen kutuna bir bak. | Companion |
| İstikrar da bir kazanç; öne geç / Consistency is a win too | İstikrar yerinde; küçük bir adım yeter. / Consistency held; one small step is enough. | Companion |
| Soru kökünü iki kez okumak burada net kazandırır. / pays off here | Soru kökünü iki kez okumak burada işe yarar. / helps here | Companion |
| Hak kazanım sınırı doldu. / The rights-earning limit | Hak sınırı doldu. / The rights limit is used up. | Companion |

## Where copy lives

- In-app / push templates: `apps/api/src/i18n/locales/{tr,en}/notifications.json`
- Achievement inbox lines: `apps/api/src/i18n/locales/{tr,en}/achievements.json` (`notification.*`)
- Email subjects/bodies: `notifications.json` → `email.*` (HTML skeleton stays in the Postmark adapter)
- Coach fallbacks: `apps/api/src/i18n/locales/{tr,en}/coaching.json` (`mood.*` except `SERIOUS_DISTRESS`, `motivation.*`, `nextAction.*`, `mentorV2.calibration`)
- AI chat persona: `mentor-v2-prompt.ts` (V2) and `coachSystemBase` in `ai.constants.ts` (V1). Prompts that produce student text follow the same em-dash ban as chrome.
- Web chrome: `apps/web/messages/{tr,en}.json` (coach, plan/community/analysis/notebook, session, study room, economy ledger empty + invite overlay + quest sheet intro / quest-complete toast, streak-rescue offer + success, optional rewarded-ad offer, weekly effort board empty + rank banners, knowledge, vision, achievements empties + collection chrome, coach access gate, deep-analysis insufficient)
- API errors: `apps/api/src/i18n/locales/{tr,en}/errors.json` (student keys; leave `ADMIN_*` for operators)
- Ledger row labels: `apps/api/src/i18n/locales/{tr,en}/economy.json` (`ledger.*`; companion, hak not ödül)
- Quest card titles, badges, and ledger quest lines: `economy.json` (`quests.*`; companion. `{target}` resolves on the card; ledger strips `{target}`. `{days}`/`{count}` come from the quest id.)
- Admin broadcasts: free text; the announcements form offers companion-register examples

Do not hardcode student-facing sentences in listeners or ledger mappers. Resolve through `NotificationsCopyService`
(or `NotificationsService.createFromTemplate`) and store `data.templateKey` + `data.args` so the
inbox can re-localize on read. Ledger titles and quest card copy resolve through `economy.json` on read (`Accept-Language`).

## Out of this constitution’s product chrome

Admin operator UI. Same dual register; do not invent a third narrator.
