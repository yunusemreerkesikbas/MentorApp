# Voice & Copy Constitution — Puhu & Companion

> **Canonical voice guide** for every Turkish and English string in `apps/web`, `apps/api`
> (`ERROR_MESSAGES`, AI system prompts, notification templates, transactional email copy), and
> editorial microcopy.
> Grounded in [`sinav-kocluk-roadmap.md`](../../sinav-kocluk-roadmap.md) §0 ("yalnız değilsin")
> and [`DESIGN.md`](../../DESIGN.md).

---

## 0. Who is speaking

One soul, **two registers**. Puhu is the study companion owl, never a teacher, parent, boss, or
cold corporate tool.

| Register | Where it speaks | Default voice |
|---|---|---|
| **Puhu (enerjik, Duolingo gibi)** | App chrome, landing (`/`), welcome (`/hosgeldin`), onboarding, empty states, CTAs, celebrations, level & achievement ceremonies, weekly nicknames, community (`Topluluk`, `Lig`, ` Çalışma Odası`), friend invite (`/davet`), coin unlock choice, waitlist (`/bekleme-listesi`), banners | **Lively, energetic, warm, cheering.** Short sentences, concrete verbs, playful momentum. Celebrates effort and presence without ever shaming absence. |
| **Companion (sakin yoldaş)** | AI coach chat (`/koc/sohbet`), low-mood check-in (`LOW`/`EXHAUSTED`), broken streak / freeze / recovery, form & API errors, payment / checkout / trial consent, account / KVKK / deletion, official exam facts & countdown | **Calm, steady, grounded.** "Ben buradayım." No exclamation marks, no mascot jokes, no pressure when the student is stressed, paying, or reading legal/official facts. |

**Rule of thumb:** If the student is **building momentum, exploring, celebrating, or joining peers**
→ **Puhu** (energetic, cheering, Duolingo-like). If the student is **struggling, configuring
payments/privacy, hitting an error, or reading official exam data** → **Companion** (calm, clear,
unhurried).

---

## 1. The 8 rules (binding on every string)

1. **Always *sen*, never *siz*.** One-to-one companionship.
   - Plural `-ler/-lar` appears only when addressing a room or group together (`Selam millet`).
   - Legal/KVKK disclosures may quote statute names in third person (`KVKK kapsamında…`) while keeping instructions in *sen* (`Onayını istediğin zaman geri çekebilirsin`).
2. **Never "lütfen".** It creates customer-service distance. Say directly what to do:
   - ❌ `Lütfen geçerli bir e-posta girin.` → ✅ `E-posta adresini kontrol et.`
3. **Never blame, shame, or induce FOMO.**
   - Never imply the user failed (`Başarısız`, `Yetersiz`, `Hatalı giriş yaptınız`, `Serini bozdun!`).
   - Never use loss-aversion or countdown pressure (`Son şans!`, `Kaçırma!`, `Arkadaşların seni geçiyor!`).
   - When something breaks, the **system** owns the hiccup (`Kaydedemedik, tekrar dener misin?`, `Bağlantı koptu, tekrar bağlanıyoruz.`).
4. **Celebrate effort and return, not rank.**
   - Praise starting, showing up, finishing a block, or coming back after a break (`Bugün de buradasın!`, `İlk adım tamam!`).
   - Never call a score "bad" or "low". Call it a baseline or starting point (`Başlangıç noktan hazır`).
5. **Short, concrete Turkish (and natural English).**
   - Headings: 2–6 words. Body/helper: 1–2 short sentences. Buttons: 1–3 words, infinitive or first-person action (`Seansa başla`, `Plana ekle`, `Haftanı Puhu’yla kur`), never imperative bark (`GÖNDER`, `KAYDET` in all-caps).
   - No corporate/bureaucratic filler (`işleminiz gerçekleştirilmiştir`, `tarafımızca`, `mevcut değildir`, `bulunmamaktadır`).
6. **Punctuation & emoji discipline.**
   - **No em dash (`—`)** in user-facing copy. Use a period, comma, or colon.
   - **No triple dots (`...`)** for drama; use `…` only on in-flight loading states (`Kaydediliyor…`).
   - **Exclamation marks (`!`):** Natural in the **Puhu** register (max **one `!` per sentence**, never `!!`). **Zero `!`** in the **Companion** register (errors, low mood, broken streak, payments, official facts).
   - **Emoji:** Optional in Puhu surfaces where defined (max one per line, never in `aria-label`, never replacing status words).
7. **AI coach naming ("Puhu" vs "koç").**
   - The AI coach is named **Puhu** across all surfaces (`Puhu, yapay zekâ koçun`, `Puhu’yla planla`, `Puhu’ya sor`, `Puhu’nun yapay zekâ notu`).
   - Plain **"koç"** or **"koçun"** is reserved for the **human coach** (`mentorship`, `/kocum`, `/koclar`, `"Koçundan"` tasks).
   - In **Turkish**, write **"yapay zekâ"** (with circumflex), **never `"AI"`** (including badges and labels). In **English**, keep `"AI"` (`Puhu, your AI coach`).
   - Inside AI coach chat replies (`modules/ai/prompts`), Puhu speaks in the **Companion** register: warm, first-person (`Ben buradayım`, `Birlikte bakalım`), without third-person self-reference or bird/owl jokes.
8. **Exam names & official facts.**
   - When listing supported exams on public/marketing surfaces (landing hero, meta tags, FAQ, blog description), name all five in catalog order: **`KPSS · YKS · LGS · ALES · DGS`**.
   - Official dates, application windows, and placement rules come **only** from verified data cards (`ContentModule`), never paraphrased into chatty approximations (`yaklaşık 3 ay kaldı` is forbidden; render the exact date + day count calmly).

---

## 2. Register guide by surface

### 2.1 Puhu register (energetic, Duolingo-like standard)

Puhu is upbeat, proud of the student, and full of life. Sentences are punchy; verbs invite action.

- **Landing (`/`) & Welcome (`/hosgeldin`):**
  - Hero: `"Işığın yanıyorsa, yalnız değilsin."` with exam eyebrow `"KPSS · YKS · LGS · ALES · DGS"`.
  - Section titles and interactive notes speak with cheerful energy (`"Haftanı Puhu kursun!"`, `"Görevleri bitir, XP ve Coin topla!"`, `"Hoş geldin, komşu!"`).
  - `/koclar` (for human coaches) stays warm and direct, with a single `!` on its closing invite.
- **Daily Panel, Quests & Weekly Chest (`/panel`):**
  - Greeting, quest completion, and the weekly chest (`"Hazır!"`, `"Sandığı aç"`) feel rewarding and tactile.
  - "Puhu’yla planla" (`plan.*`) frames weekly planning as a shared ritual (`"Haftanı Puhu’yla kur"`).
- **Community, Study Rooms & League (`/topluluk`, `/topluluk/oda/[id]`):**
  - Cheerful peer energy (`"Selam millet! Bugün ne çalışıyoruz?"`, `"Masaya otur"`, `"Birlikte çalışınca zaman başka akıyor!"`).
  - League (`Lig`) celebrates climbing and active days (`"Bu hafta ligde ter dökenler!"`) without shaming anyone at the bottom (no bottom rankings or demotion threats).
- **Levels, Weekly Nicknames & Achievements (`/profil`, ceremonies):**
  - **12 Level names:** Concrete objects and places on a night-to-dawn journey (`Kıvılcım`, `Mum`, `Fener`, `Masa Lambası`, `Pusula`, `Harita`, `Kamp Ateşi`, `Kule`, `Ufuk`, `Şafak`, `Güneş`, `Zirve`) with energetic one-line subtitles.
  - **Weekly nicknames (`weekly-nickname.ts`):** Playful, earned titles based on the week's rhythm (`Gece Nöbetçisi`, `Sabah Kuşu`, `Maratoncu`, `Demir Seri`, `İlk Kıvılcım`, etc.).
  - **Achievements & Badges:** "Işık Yandı" ceremony uses celebratory Puhu copy (`"Yeni rozet açıldı!"`, `"Emeğinin izi burada!"`).
- **Friend Invite (`/davet`, `/davet/[code]`):**
  - Warm, shared-table framing (`"Arkadaşını masaya çağır, birlikte çalışın!"`). Rewards are framed as earned study rights (`hak` / `Coin`), never cash.
- **Coin Unlock Choice (AI & feature unlocks):**
  - Energetic framing for spending earned Coin (`"Emeğinle açtın!"`, `"Coin ile aç"`). Coin is never called money/price (`ücret`, `satın al`, `bakiye` are forbidden; use `Coin`, `hak`, `aç`).
- **Waitlist (`/bekleme-listesi`, invite-only gate):**
  - Welcoming, club-door warmth (`"Sıranı ayırdık!"`, `"Davet kodun varsa hemen gir"`), never cold rejection.

### 2.2 Companion register (calm, steady standard)

When vulnerability, friction, money, or legal clarity is on screen, Puhu drops the exclamation marks and sits quietly beside the student.

- **AI Coach Chat (`/koc/sohbet`) & Reflections:**
  - Steady, attentive, non-judgmental. Validates feelings before suggesting small, doable steps (`"Bugün yorgun olman çok doğal. Sadece 15 dakikalık tek bir blokla başlayalım mı?"`).
- **Low Mood (`LOW`, `EXHAUSTED`) & Broken Streak:**
  - Zero guilt. If a streak resets or a freeze is used: `"Seri sıfırlandı ama çalıştığın günler seninle. Bugün yeni bir ilk gün."`
- **Errors, Rate Limits & Empty Searches:**
  - Plain, helpful, system-owned (`"Şu an bağlantı kuramadık, birazdan tekrar dene."`, `"Buna uyan bir sonuç yok."`, `"Şimdi kaydolmadı."`).
- **Payments, Checkout & Trial Disclosures (`/abonelik`, Paywall footer):**
  - Transparent and exact. Pre-contractual consent (`ön bilgilendirme`) states exact first charge, trial length, and renewal price without hype or fake strikethrough discounts.

---

## 3. Forbidden words & replacements

| ❌ Never write | ✅ Write instead | Why |
|---|---|---|
| `Lütfen … girin / deneyin` | Direct *sen* verb (`… gir`, `… tekrar dene`) | Customer-service distance |
| `İşleminiz başarısız oldu` | `Kaydedemedik, tekrar dener misin?` | Bureaucratic + blames user |
| `Bulunmamaktadır / Mevcut değildir` | `Henüz yok` / concrete next step | Officialese |
| `AI koç` / `AI notu` *(in Turkish)* | `Puhu, yapay zekâ koçun` / `Puhu’nun yapay zekâ notu` | TR uses "yapay zekâ" and names the AI coach Puhu |
| `Koç` *(when meaning the AI)* | `Puhu` | Plain "koç" = human coach (`mentorship`) |
| `Bakiye / Satın al / Ücret` *(for Coin)* | `Coin / Coin ile aç / Hak` | Guardrail §4 #3: Coin is non-monetary |
| `Sınırsız sohbet` | Exact daily allowance or benefit description | Coach chat has a daily fair-use cap |
| `Son şans! / Kaçırma!` | Plain validity date (`30 Eylül tarihine kadar geçerli`) | No FOMO or loss-aversion |
| `—` *(em dash)* | `.` or `,` or `:` | AI-slop punctuation |

---

## 4. Before → After examples

| Surface | ❌ Before (old / generic) | ✅ After (canonical) | Register |
|---|---|---|---|
| Landing hero | `Sınav hazırlık platformu` | `Işığın yanıyorsa, yalnız değilsin.` | Puhu |
| Plan wizard CTA | `Koçla planla` | `Puhu’yla planla` | Puhu |
| Quest section | `Günlük görevleriniz` | `Görevleri bitir, XP ve Coin topla!` | Puhu |
| Community room | `Odaya katılmak için tıklayınız` | `Masaya otur, birlikte çalışalım!` | Puhu |
| Broken streak | `Serini kaybettin! Baştan başla.` | `Seri sıfırlandı ama emeğin duruyor. Bugün yeniden başlıyoruz.` | Companion |
| API / Save error | `Lütfen daha sonra tekrar deneyiniz.` | `Şimdi kaydolmadı. Birazdan tekrar dener misin?` | Companion |
| Paywall consent missing | *(Disabled grey button)* | Live CTA → focus checkbox + `Devam etmek için ön bilgilendirme kutusunu işaretle.` | Companion |

---

## 5. Where copy lives

- **Web (`apps/web`):** `apps/web/messages/tr.json` and `apps/web/messages/en.json` (mirrored keys, checked in CI). Always read via `useTranslations` / `getTranslations`.
- **Backend (`apps/api`):**
  - Error messages: `apps/api/src/common/errors/error-messages.ts` (`tr` + `en` per `ErrorCode`).
  - AI prompts: `apps/api/src/modules/ai/prompts/` (system prompts enforce Companion register + KVKK summary rules).
  - Notification & email templates: `apps/api/src/modules/notifications/` (`tr` + `en`).
- **Editorial seeds:** `docs/editorial/` and `apps/api/src/modules/content/`.
