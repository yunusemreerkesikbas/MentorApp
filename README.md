# Mentor

> Sınav hazırlığının uzun, yalnız ve yıpratıcı yolunda seni **anlayan, devam ettiren ve yalnız
> bırakmayan** bir AI koç + topluluk. "Bilgi platformu" değil — **yoldaşlık platformu**.

---

## Neden bu ürün?

Hedef kitlenin en derin acısı **bilgi eksikliği değil**; yalnızlık, motivasyon çöküşü ve bırakma.
Rakipler (soru bankası / içerik uygulamaları) tam buraya kör. Mentor, "bu süreçten sağ çıkma"yı
satar — soru/bilgi/araç değil.

> Markette ayıran cümle: *Rakipler "soru / bilgi / araç" satıyor; biz "bu süreçten sağ çıkma" satıyoruz.*

**Sınav-agnostik:** AI koç, ritüel, sosyal ve analiz mantığı tüm sınavlarda (KPSS/YKS/LGS) **aynıdır**;
sınavlar yalnızca **içerik/config** ile ayrışır (konu taksonomisi, net kuralı, takvim kaynağı).
**KPSS** fikrin çıkış noktası ve ilk tohumlanacak içeriktir.

---

## Ürünün üç katmanı

| Katman | Rol | Açıklama |
|---|---|---|
| **AI Koç (omurga)** | Gün-1 değer | Planı, analizi, çalışma seanslarını ve bilgi merkezini birbirine bağlayan tek bileşen. Davranış-temelli, "seni hatırlayan" hafıza profili. |
| **Ritüel (motor)** | Retention | Günlük açtıran katman: çalışma seansı (Pomodoro) + streak + AI check-in. Değer değil, **alışkanlık** üretir. |
| **Topluluk (ruh + moat)** | Ağ etkisi | Mahalle (kohort), forum ve ödül ekonomisi. Yalnızlığa panzehir; kopyalanması en zor savunma hattı *(Faz 2)*. |

**Wedge vs. Moat:** erken dönem moat = davranış verisi; kütle sonrası moat = topluluk ağ etkisi.

---

## Öne çıkan tasarım ilkeleri (roadmap'ten)

- **Çabada rekabet, sonuçta asla.** Çalışma saati/streak/tutarlılık sıralanır; net/puan **asla** sıralanmaz
  (demoralizasyon önleme). "En alttakiler" utandırması yok; geri sayım sakin, alarm-kırmızısı değil.
- **Mahalle (~25-30 kişi kapalı kohort):** dönem-bazlı ortak yolculuk (birlikte geri sayım → sınav → mezuniyet).
  Az kullanıcıyla bile "dolu" hissi → forumdan iyi cold-start.
- **Bilgi merkezi = güven çapası:** küratörlü editoryal içerik (A-katmanı) → hem SEO sayfası hem AI koçun
  RAG kaynağı. Resmi bilgi (tarih/süreç) **asla LLM'e serbest ürettirilmez** — doğrulanmış içerikten gelir.
- **Hibrit maliyet mimarisi:** günlük teması ucuz **kural motoru** sağlar; LLM yalnız katma-değerli anda
  → "algı günlük, maliyet seyrek".

---

## İş modeli (özet)

```
B2C (öğrenci)        → freemium abonelik            ← taban gelir
Koçlar               → marketplace komisyonu        ← Faz 3 ölçek
B2B (kurum/dershane) → öğrenci-başı lisans           ← en stabil/yüksek marj, nakit tamponu
```

- **Ücretsiz = sosyal + araçlar (AI minimize)**, **Premium = AI derinliği** (huni + monetizasyon).
- AI hakkının 3 kaynağı: abonelik allowance · top-up (para) · **kazanılan** (davet + görev, self-funding).
- **Coin parasal değildir** (tavanlı, sınırlı premium-özellik kapısı); XP ≠ Coin (itibar ≠ harcanan birim).

---

## Faz yol haritası

| Faz | Kapsam |
|---|---|
| **Faz 0** *(lansman öncesi)* | Şirket + iyzico başvuru + yasal sayfalar + fiyat/WTP araştırması + içerik tohumlama (KPSS). |
| **Faz 1 — MVP** | **Responsive web B2C + yalın admin.** Onboarding · AI koç (hibrit check-in) · plan + geri sayım · Pomodoro + streak · deneme analizi · bilgi merkezi (okuma + grounded AI) · freemium abonelik (kartlı trial) · kazanılan AI hakkı (davet/görev) · web push + e-posta. |
| **Faz 2** | Mahalle + forum + ödül ekonomisi · rekabet/işbirliği · **mobil app (#1)** · koç (BYOS) + companion · yalın B2B (org panel + sanal sınıf + koç zekâ katmanı) · Redis · canlı çalışma odası · OCR giriş. |
| **Faz 3** | Marketplace (koç keşfi/vitrin) · % komisyon (azalan) · platform-içi chat · B2B derinleşme · ölçekte managed K8s. |

> Detaylı kararların tek kaynağı: **[sinav-kocluk-roadmap.md](./sinav-kocluk-roadmap.md)**.

---

## Teknoloji

Tek dil **TypeScript** · **Turborepo + pnpm** monorepo · **NestJS** (modüler monolit) · **Next.js** (web/admin)
· **Expo** (mobil, Faz 2) · **Neon Postgres + pgvector + Drizzle** · Cron+jobs kuyruğu (port; Faz 2 BullMQ+Redis)
· **Cloudflare** (edge/R2/Turnstile/Access) · **Render** · **iyzico** · **OpenAI + Gemini** · kendi JWT · Postmark · Sentry.

```
apps/      api (NestJS) · web (Next.js) · admin (Next.js) · mobile (Expo·F2) · panel (F2)
packages/  types · validation · core · api-client · ui · config
```

---

## Geliştirici dokümantasyonu

| Doküman | İçerik |
|---|---|
| **[AGENTS.md](./AGENTS.md)** | Mühendislik & agent yönergesi (kanonik) — stack, modül haritası, koruyucu kurallar |
| **[docs/](./docs/README.md)** | Mimari · dosya yapısı · konvansiyonlar · kurulum · entegrasyonlar |
| **[docs/standards/](./docs/standards/code-review.md)** | engineering-principles · code-style · api · backend · frontend · mobile · code-review |
| **[docs/features/](./docs/features/README.md)** | Özellik dokümanları ve geliştirme günlüğü (timeline) |
| **[DESIGN.md](./DESIGN.md)** | Tasarım sistemi (Nuton tabanlı) |

**Kurulum & çalıştırma:** [docs/core/setup.md](./docs/core/setup.md) (`pnpm install` → `pnpm dev` → api:3001 · web:3000 · admin:3002).

---

## Lisans
Özel / tescilli (private). Tüm hakları saklıdır.
