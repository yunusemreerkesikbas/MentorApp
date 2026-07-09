# Headroom — context compression

> [Headroom](https://github.com/headroomlabs-ai/headroom) sıkıştırır: tool çıktıları, dosya okumaları, loglar, RAG chunk'ları, konuşma geçmişi — LLM'e gitmeden önce. **Aynı cevap, daha az token.**

Bu repoda **iki ayrı kullanım** vardır; birbirine karıştırma:

| Mod | Ne zaman | Nasıl |
|---|---|---|
| **A — Geliştirme (vibe coding)** | Cursor, Claude Code, Codex ile **bu repoyu geliştirirken** | `headroom` CLI + `wrap` (makinede Python) |
| **B — Ürün (koç sohbeti)** | Son kullanıcı uygulamada **koça yazdığında** | Docker sidecar + API flag (NestJS) |

Mod A günlük geliştirme maliyetini düşürür. Mod B production koç maliyetini düşürür (MVP'de kazanç küçük; Phase 2 multi-turn'da anlamlı).

---

## A — Geliştirme: Cursor · Claude Code · Codex

Headroom **ürün kodunun parçası değil**; geliştirici makinesinde çalışan bir proxy. Agent'ın okuduğu her şeyi sıkıştırır (dosya arama, terminal, tool JSON, vb.).

### 1. Kurulum (bir kez)

**Python 3.10+** gerekli.

```bash
# Önerilen (izole global CLI)
uv tool install "headroom-ai[all]"

# Alternatif
pip install "headroom-ai[all]"
```

Doğrula:

```bash
headroom doctor
# veya repo script'i:
pnpm headroom:doctor
```

Windows'ta `headroom` PATH'te değilse: `uv tool install` sonrası `uv tool dir` çıktısındaki klasörü PATH'e ekle.

### 2. Agent'ı sarmala (her geliştirme oturumu)

```bash
# Claude Code (terminal)
pnpm headroom:wrap claude

# OpenAI Codex CLI
pnpm headroom:wrap codex

# Cursor — proxy başlar, ayar URL'lerini yazdırır
pnpm headroom:wrap cursor
```

`headroom wrap` şunları yapar: local proxy (~8787), MCP araçları, agent'ı proxy üzerinden yönlendirme.

**Cursor notu:** Headroom README'de Cursor için "manual setup" denir — `wrap cursor` proxy'yi açar ve **Cursor Settings'te kullanacağın base URL'leri** terminale basar. Çıktıdaki `OPENAI_BASE_URL` / Anthropic override talimatlarını uygula. Cursor zaten açıksa bir kez ayarla; sonraki `wrap` oturumları aynı portu kullanır.

### 3. Sarmalamayı kaldır

```bash
pnpm headroom:unwrap claude   # veya codex, copilot, …
```

Desteklenen `unwrap` hedefleri: `claude`, `copilot`, `codex`, `openclaw`, `opencode` ([Headroom README](https://github.com/headroomlabs-ai/headroom)).

### 4. Tasarrufu izle

Proxy ayaktayken:

```bash
curl http://localhost:8787/stats
headroom dashboard    # tarayıcıda canlı panel
```

### 5. İpuçları

- **Her yoğun coding günü** yeni terminalde `pnpm headroom:wrap <agent>` ile başla.
- Proxy zaten çalışıyorsa (`pnpm headroom:up` koç sidecar'ı da 8787 kullanır) — **aynı portu paylaşırlar**; koç sidecar + dev wrap aynı anda tek proxy instance. Koç test etmiyorsan sadece `wrap` yeterli (kendi proxy'sini açar).
- **Port çakışması:** Koç Docker sidecar (`pnpm headroom:up`) ve `headroom wrap` ikisi de 8787 isteyebilir. Geliştirme-only: `headroom:up` kullanma, sadece `wrap`. Koç API testi: `headroom:up` + API env; o sırada ayrı `wrap` gerekmez.
- Telemetry kapalı tutmak için: `HEADROOM_TELEMETRY=off` (Docker sidecar'da zaten kapalı).
- Resmi dokümantasyon: [headroom-docs.vercel.app](https://headroom-docs.vercel.app/docs)

---

## B — Ürün: Koç sohbeti (NestJS API)

Son kullanıcı `POST /v1/coach/chat` çağırdığında, API isteği OpenAI'ye gitmeden önce prompt'u sıkıştırabilir.

### Mimari

```
ChatService
  → buildSystemPromptParts()   # core + RAG ayrımı
  → PromptCompressionService   # flag + proxy kontrolü
  → HeadroomContextCompressionAdapter  → POST /v1/compress
  → LlmPort (OpenAI)
```

**§4 #1:** Doğrulanmış `KAYNAK MAKALELER` bloğu **asla sıkıştırılmaz** — sadece guardrails + BAĞLAM + user mesajı.

### Aktifleştirme (local)

```bash
# 1. Sidecar
pnpm headroom:up

# 2. API env (apps/api/.env)
HEADROOM_PROXY_URL=http://localhost:8787

# 3. Admin config registry
ai.compression.enabled = true   # varsayılan: false
```

Sağlık:

```bash
curl http://localhost:8787/health
pnpm headroom:doctor
```

### Davranış

| Durum | Sonuç |
|---|---|
| Flag kapalı veya `HEADROOM_PROXY_URL` yok | Passthrough, değişiklik yok |
| Flag açık + proxy ayakta | Core + user sıkışır, RAG aynen eklenir |
| Proxy hata | Uncompressed fallback + warn log; chat kesilmez |

### MVP beklentisi

Prompt küçük (single-turn, max 3 RAG snippet) → tasarruf **düşük**. Phase 2 **multi-turn + memory** ile değer artar. Flag kapalı bırakılabilir; kod hazır.

### İlgili dosyalar

- `apps/api/src/modules/ai/domain/context-compression.port.ts`
- `apps/api/src/modules/ai/application/prompt-compression.service.ts`
- `apps/api/src/modules/ai/infrastructure/adapters/headroom-context-compression.adapter.ts`
- `docker/headroom/Dockerfile`, `docker-compose.yml` (`headroom` service)
- Config: `ai.compression.enabled` in `config.catalog.ts`
- Feature timeline: [features/ai.md](../features/ai.md)

### Production (Render)

`docker/headroom` imajını **private service** olarak deploy et; API `HEADROOM_PROXY_URL` ile aynı private network'te işaret et. Detay: [integrations.md](../core/integrations.md).

---

## Komut özeti

| Komut | Açıklama |
|---|---|
| `pnpm headroom:install` | `headroom-ai[all]` kurulumunu dener (pip/uv) |
| `pnpm headroom:doctor` | CLI + opsiyonel proxy health |
| `pnpm headroom:wrap <agent>` | `claude` \| `codex` \| `cursor` — dev oturumu |
| `pnpm headroom:unwrap <agent>` | Sarmalamayı geri al |
| `pnpm headroom:up` | **Koç** Docker sidecar (8787) |
| `pnpm headroom:down` | Sidecar durdur |

---

## Geliştirmeler (timeline)

- **2026-07-10** — Mod B: koç API entegrasyonu (`ContextCompressionPort`, RAG bypass, Docker sidecar, `ai.compression.enabled`). Mod A: bu doküman + `scripts/headroom-dev.mjs` wrap/doctor/install script'leri.
