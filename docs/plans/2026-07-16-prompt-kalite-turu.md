# Prompt Kalite Turu — Görünür Çekirdek (2026-07-16)

> Kapsam: koç chat (`COACH_SYSTEM_BASE` + FOLLOWUP/TASK) · günlük selam · plan taslağı · mood
> yansıması. Yöntem: dev API + gerçek OpenAI (gpt-4o-mini), 11 önce-probu + 5 sonra-probu
> (STAFF test kullanıcısı; cache satırları SQL ile temizlenerek varyantlar alındı).
> Kararlar: emoji seyrek/hiç, düzeltmeler koda + bu rapor.

## Bulgular ve yapılan değişiklikler

### 🐛 1. TASK marker'ı kullanıcıya sızıyordu (kod düzeltmesi)

Model, prompt'un istediği sıranın tersine `<<TASK{...}>>`'ı `<<FOLLOWUP[...]>>`'tan ÖNCE yazınca
END-anchored iki-adımlı extraction TASK'ı kaçırıyor ve marker kullanıcı balonuna sızıyordu
(canlıda görüldü). Ayrıca model marker'ı BOZUK yazarsa (`...]]` — `>>` eksik, canlıda görüldü)
hiçbir regex eşleşmiyor ve enkaz sızıyordu.

**Düzeltme:** `extractReplyMarkers` (suggested-task.ts) — sıra-bağımsız döngüyle iki trailing
marker'ı da soyar + son çare hijyeni: tam marker'lar nerede olursa olsun silinir, bozuk/yarım
marker başlangıcından itibaren metin kesilir. `chat.service`'in 3 yolu (blocking/stream/regenerate)
buna geçti. Spec: ters sıra + bozuk marker senaryoları.

**Önce:** `...Başarılar dilerim! <<TASK{"title":"Matematik Soru Çözümü",...}>>` (balonda görünür,
kart yok) → **Sonra:** temiz metin + `suggestedTask` kartı doğru geliyor.

### 🐛 2. Premium chat limiti TÜM AI çağrılarını sayıyordu (kod düzeltmesi)

`assertPremiumRateLimit` `countSince` (feature'sız) kullanıyordu — günlük selam / plan taslağı /
mood çağrıları chat kotasını yiyordu (probe sırasında 30'a bu yüzden ulaşıldı). **Düzeltme:**
chat limiti ve `dailyMessagesRemaining` göstergesi artık `countFeatureSince(CHAT)` sayar; diğer
özelliklerin kendi cap'leri zaten var.

### 3. Chat: uzunluk + bağlam sızması + FOLLOWUP boşlukları (prompt)

- Yanıtlar 6+ maddeli ve uzun geliyordu → BİÇİM kuralı: "KISA tut — 3-6 cümle veya en fazla 5
  kısa madde; detay istenirse uzat" + "emoji en fazla 1" + "kalıp coşku cümlesi/ünlem yığını yok".
- Alakasız soruların sonuna bağlamdan çağrı ekleniyordu ("Şimdi Matematik çalışmana odaklan" —
  paragraf sorusunda) → BAĞLAM KULLANIMI kuralı: yalnız soruyla ilgiliyse değin.
- "merhaba"da FOLLOWUP atlanıyordu → "kısa selamlaşmalar dahil" + "sorular KULLANICININ ağzından".
- SIRA kuralı netleştirildi (metin → FOLLOWUP → TASK) — kod artık sıradan bağımsız olsa da modelin
  işi kolaylaştırıldı.

**Sonra-probu:** "merhaba" → 3 cümle + 3 kullanıcı-sesli takip chip'i; görev isteği → 5 cümle,
madde listesi yok, TASK kartı doğru; normal soru belirgin kısa.

### 4. Günlük selam: uzunluk + markdown/emoji (prompt)

Selam 2-3 cümle sözünü aşıyor, `**kalın**` markdown içeriyordu (selam DÜZ metin render edilir —
yıldızlar ham görünür!) ve 💪/🌟 ile bitiyordu. → "EN FAZLA 3 cümle, tek paragraf; markdown ve
emoji KULLANMA; yalnız EN alakalı bağlam verisine değin; kalıp coşku yok".

**Önce:** 2 paragraf + bold + 🌟 → **Sonra:** 3 cümle, düz metin, emoji'siz, sakin ve kişisel.

### 5. Mood yansıması: zaten iyiydi (küçük prompt eki)

Kısa, sıcak, notu kullanıyor. Yalnız markdown/emoji/ünlem-yığını koruması eklendi.

### 6. Plan taslağı: JSON disiplini kusursuz (küçük prompt ekleri)

İki probda da geçerli JSON, klamp ihlali yok, not'a uyum iyi ("Türkçe'ye ağırlık" → görev
dağılımına yansıdı). Tek pürüz: bugünkü planda ZATEN olan görev ("Matematik: 30 soru") yeniden
öneriliyordu → "bugünkü planda zaten olan görevleri tekrar önerme" + "başlıklarda emoji yok"
kuralları eklendi. *(Sonra-probu günlük cap + config-cache nedeniyle alınamadı — değişiklik düşük
risk, bir sonraki gerçek kullanım doğrular.)*

### ✅ Doğrulanan iyi davranışlar

- Resmî bilgi tuzağı ("KPSS başvurusu ne zaman, kaç TL?") → tarih/ücret UYDURMADI, /bilgi'ye
  yönlendirdi (§4 #1 canlıda çalışıyor).
- Kaygı mesajında ton sıcak ve yargısız; RAG kaynak yoksa uydurma yok.

## Operasyonel notlar

- Ham SQL ile `config_overrides` değişikliği registry cache'ine YANSIMAZ — admin API'den yapılmalı
  (test sırasında öğrenildi; bug değil, cache invalidation admin yolundan çalışıyor).
- Dev'de `preview_stop` sonrası API süreci portu tutarak yaşayabiliyor (zombi) — problar saatlerce
  eski kodu ölçtü. Şüphede: `Get-NetTCPConnection -LocalPort 3001` ile süreç başlangıcını doğrula.

## Test durumu

AI modülü 129/129 birim + `ai-coach` e2e 13/13 (fake) + typecheck yeşil. Değişen dosyalar:
`suggested-task.ts`(+spec), `chat.service.ts`, `coach-access.service.ts`(+spec), `ai.constants.ts`.

## Tur 2 — Kalan 5 prompt (aynı gün)

Veri kurulumu: `seed:analysis-demo` (8 deneme) + vision board + finalize edilmiş seans + mikro
check-in. 5 önce-probu + 4 sonra-probu (memory job-driven olduğundan yalnız mevcut damıtma
incelendi; cache'ler SQL ile temizlendi, weekly `WEEKLY_REVIEW_PROMPT_VERSION` v1→v2 bump'ıyla
kendi kendine yeniden üretildi).

| Prompt | Bulgu | Değişiklik | Sonra |
|---|---|---|---|
| Ghost | 🎉 emoji, 5 cümle, "harika"×3 | max 3 cümle + markdown/emoji/coşku yasağı | 3 cümle, emoji'siz ✓ |
| Vision note | "Sevgili öğrencim" hitabı, 4 cümle | hitap kalıbı yasağı + max 3 cümle + emoji/markdown yasağı | hitap gitti, 3 cümle ✓ |
| Seans yansıması | uzun + coşku + TASK'ta bugünkü plandaki görevin kopyası | max 3 cümle + coşku/emoji yasağı + "plandaki görevi önerme" | kısa ✓, öneri notla ilgili ✓; **kalıntı:** model mevcut görevi bazen başka kelimelerle yine öneriyor (zararsız — kullanıcı onayı şart; deterministik benzerlik filtresi backlog) |
| Haftalık özet | zaten iyi (3 cümle, sakin) | yalnız markdown/emoji koruması + v2 bump (cache yenilensin) | 3 cümle düz ✓ |
| Memory damıtma | içerik mükemmel ama `**bold**` markdown (FE kartı düz metin — ham yıldız) | "markdown/emoji yok, düz 'Etiket: değer' maddeleri" kuralı | job-driven — bir sonraki damıtmada doğrulanır (düşük risk) |

Test durumu (tur 2 sonrası): AI birim 129/129 · `ai-coach` e2e 13/13 · typecheck yeşil.
Değişen dosyalar: `ai.constants.ts` (ghost/vision/seans/memory prompt'ları),
`weekly-review-prompt.ts` (kural + v2).

## Prompt eval v1 ve ciddi-sinyal güvenlik kapısı (2026-07-17)

Opt-in `pnpm --filter @mentor/api test:eval:openai` komutu 10 sentetik vakayı raporlar:
9 gerçek OpenAI completion + 1 deterministik ciddi-mood güvenlik yolu. Nesnel ihlaller hard,
üretken modelin cümle sayısı gibi stil sapmaları review uyarısıdır. Son doğrulama: 10 vaka,
0 hard failure, 2 review uyarısı; güvenlik vakası 0 token/0 maliyet.

Gerçek eval, ciddi sinyal prompt'una rağmen modelin çalışma görevi önerebildiğini tekrarlı biçimde
gösterdi. Prompt'u tekrar sıkılaştırmak yerine `MoodReflectionService` içine cache ve LLM'den önce
yüksek güvenli TR/EN ifade algısı eklendi. Eşleşmede lokalize sabit destek mesajı `model: safety`
olarak döner; context, bütçe, provider, usage ve DB yazımı çalışmaz. Yeni endpoint, migration,
bağımlılık veya kullanıcı verisi yoktur.

## Kapsam dışı / sonraki tur

Temperature/parametre tuning, seans-TASK mükerrer önerisi için
deterministik benzerlik filtresi, memory damıtmasının canlı doğrulaması (bir sonraki 10-mesaj
job'ında kendiliğinden).
