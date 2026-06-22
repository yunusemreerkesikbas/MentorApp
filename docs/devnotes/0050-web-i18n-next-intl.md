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
### Statik render (ON — v4 olmadan)

Statik render / ISR **açık**; v4 gerekmedi. İki parça gerekti:

1. **Turbopack alias.** next-intl 3.26 plugin'i Turbopack config alias'ını (`next-intl/config`) **`experimental.turbo`**
   key'ine yazıyor; Next 16 bu key'i okumuyor (`turbopack` oldu) → statik export "Couldn't find next-intl config file"
   verir. Çözüm: `next.config.ts`'te alias'ı doğru key'de elle ver:
   ```ts
   turbopack: { resolveAlias: { "next-intl/config": "./src/i18n/request.ts" } }
   ```
   (Plugin eski key'i de set ettiği için "Unrecognized key 'turbo'" uyarısı kalır — zararsız, v4'te gider.)
2. **`<html>`'i `[locale]/layout.tsx` sahiplenir.** Eskiden root `app/layout.tsx` `<html lang>` için `await getLocale()`
   çağırıyordu; bu `[locale]` dışında `setRequestLocale`'siz çalıştığı için **tüm ağacı dinamiğe zorluyordu** (sayfalar
   prerender edilse bile `ƒ`). `app/layout.tsx` **kaldırıldı**; `<html>`/`<body>` + fontlar + `globals.css` artık
   `[locale]/layout.tsx`'te (`locale` awaited param'dan — dinamik okuma yok). Global `/_not-found` ayrı root'a gerek
   kalmadan statik (`○`) üretiliyor.

Bunlarla `setRequestLocale(locale)` **her server page/layout'ta** çağrılır:
- `(app)` layout **client** → her `(app)` page'i (panel, profil, … 9 sayfa) awaited `params`'tan locale alır.
- `(auth)` layout **server** → tek noktada 5 auth (client) sayfasını kapsar.
- landing (`●`/ISR `revalidate=3600`) + `bilgi/[slug]` (on-demand ISR, `ƒ`). `fetchInfoArticlesByFamily` server'da
  `{ revalidate }`, client'ta (`bilgi-shell`) `no-store`.
- **Yeni `[locale]` server page/layout eklerken `setRequestLocale(locale)` çağır** — yoksa o sayfa `ƒ`'ye düşer.

### Directory restructure

Tüm `src/app/` içeriği `src/app/[locale]/` altına taşındı:
```
src/app/[locale]/layout.tsx → root document: <html lang>/<body> + fontlar + globals +
                              NextIntlClientProvider + AuthProvider + BackgroundBlobs
                              (ayrı src/app/layout.tsx YOK — bkz. Statik render)
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
- `[locale]/layout.tsx` `<html lang={locale}>`/`<body>`'yi sahiplenir (awaited `params`'tan); ayrı `src/app/layout.tsx` yok
- Yeni string eklenmesi gerekirse hem `messages/tr.json` hem `messages/en.json` güncellenmeli
- Backend zaten TR/EN locale desteğine sahip; frontend `Accept-Language` header gönderdiği için mesajlar otomatik locale'de geliyor

## Related files

- `apps/web/src/middleware.ts`
- `apps/web/src/i18n/routing.ts`, `request.ts`, `navigation.ts`
- `apps/web/messages/tr.json`, `messages/en.json`
- `apps/web/src/components/language-toggle.tsx`
- `packages/api-client/src/http.ts`
- `apps/api/src/i18n/` (zaten TR/EN locale dosyaları vardı)
