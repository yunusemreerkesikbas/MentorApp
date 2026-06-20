# 0050 — Web i18n: next-intl TR/EN

## What was done

`apps/web` için URL tabanlı (`/en/` prefix) TR/EN i18n desteği eklendi.

### Infrastructure

- **`next-intl@^3.26.0`** bağımlılık olarak eklendi
- **`src/middleware.ts`** — next-intl middleware; `_next`, `api`, statik dosyaları atlıyor
- **`src/i18n/routing.ts`** — `locales: ["tr", "en"]`, `defaultLocale: "tr"`, `localePrefix: "as-needed"` (Türkçe URL'de prefix yok, İngilizce `/en/…`)
- **`src/i18n/request.ts`** — server-side locale + messages yükleme
- **`src/i18n/navigation.ts`** — next-intl'den locale-aware `Link`, `useRouter`, `usePathname`, `redirect`, `getPathname` re-exportu
- **`next.config.ts`** — `createNextIntlPlugin` ile sarıldı
- **`messages/tr.json`** + **`messages/en.json`** — 14 namespace, ~290 key

### Locale validation & not-found

- **`[locale]/layout.tsx`** — geçersiz segment reddi: `!routing.locales.includes(locale)` → `notFound()`.
  `hasLocale` next-intl v3.26'da public export **değil** (v4'te geldi), manuel kontrol kullanıldı.
- **`src/app/layout.tsx`** — root layout `<html lang>` için `getLocale()` çağırıyor; bu `[locale]` segmenti
  dışında (global `/_not-found` statik prerender'ı) throw eder → `try/catch` ile `routing.defaultLocale`'e düşülür.
  Bu olmadan `next build`, `/_not-found` için "Couldn't find next-intl config file" ile patlıyordu.
- **Render modu: tümü dynamic (ƒ).** Statik render bilinçli olarak açılmadı: next-intl v3'te statik prerender her
  page'de `setRequestLocale(locale)` ister; bu ayrı/incremental bir iş (her sayfaya tek tek eklenmeli). O zamana
  kadar `generateStaticParams`/`setRequestLocale` eklemeyin — aksi halde build prerender hatası verir.

### Directory restructure

Tüm `src/app/` içeriği `src/app/[locale]/` altına taşındı:
```
src/app/layout.tsx          → minimal root (font injection + getLocale → lang attr)
src/app/[locale]/layout.tsx → NextIntlClientProvider + AuthProvider + BackgroundBlobs
src/app/[locale]/(app)/     → kimlik doğrulamalı rotalar
src/app/[locale]/(auth)/    → auth rotaları
src/app/[locale]/_components/ → landing bileşenleri
src/app/[locale]/bilgi/     → bilgi merkezi public sayfaları
```

### API client

- **`packages/api-client/src/http.ts`** — `ApiClientConfig`'a `getLocale?: () => string` eklendi
- Her API isteğinde `Accept-Language` header'ı gönderiliyor → backend zaten TR/EN locale dosyalarına sahip (`nestjs-i18n`)
- Network error fallback mesajı locale-aware hale getirildi

### Component changes

- **60+ bileşen**: `useTranslations('namespace')` hook'u eklendi
- **Tüm cross-directory importlar** `@/` alias'ına geçirildi (`../../../../components/form` → `@/components/form` vb.)
- **`next/link`** → `@/i18n/navigation`'dan `Link` (locale prefix otomatik)
- **`next/navigation`'dan `useRouter`/`usePathname`** → `@/i18n/navigation` (locale-aware)
- **`"Bir hata oluştu."` fallback'leri** kaldırıldı → `err instanceof Error ? err.message : String(err)`
- **Locale-aware date formatting**: `toLocaleDateString("tr-TR", ...)` → `toLocaleDateString(locale, ...)`

### Language switcher

- **`src/components/language-toggle.tsx`** — yeni bileşen; `useTransition` ile smooth locale switch
- **`LandingHeader`**: sağ nav'da "Giriş" butonundan önce `TR | EN` toggle
- **`AppNav` sidebar (desktop)**: alt kısma `LanguageToggle` eklendi (mobile tab bar değişmedi)

### auth-context

- `useLocale()` hook'u ile aktif locale alınıyor
- `configureApiClient({ getLocale: () => locale })` → locale değişince API client güncelleniyor

## Usage

```tsx
// Client component
import { useTranslations } from "next-intl";
const t = useTranslations("panel");
// t('greeting', { name: user.name })

// Server component / page
import { getTranslations } from "next-intl/server";
const t = await getTranslations("panel");
```

## Gotchas

- `messages/` dizini `apps/web/` root'unda (src/ içinde değil)
- `@/i18n/navigation`'dan `Link` import edilmeli — `next/link` değil
- `useSearchParams` hâlâ `next/navigation`'dan (next-intl override etmiyor)
- `[locale]/layout.tsx` `<html>`/`<body>` render etmiyor — bunlar root layout'ta; `lang` attribute root layout'ta `getLocale()` ile set ediliyor
- Yeni string eklenmesi gerekirse hem `messages/tr.json` hem `messages/en.json` güncellenmeli
- Backend zaten TR/EN locale desteğine sahip; frontend `Accept-Language` header gönderdiği için mesajlar otomatik locale'de geliyor

## Related files

- `apps/web/src/middleware.ts`
- `apps/web/src/i18n/routing.ts`, `request.ts`, `navigation.ts`
- `apps/web/messages/tr.json`, `messages/en.json`
- `apps/web/src/components/language-toggle.tsx`
- `packages/api-client/src/http.ts`
- `apps/api/src/i18n/` (zaten TR/EN locale dosyaları vardı)
