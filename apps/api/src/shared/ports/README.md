# shared/ports — Ports & Adapters (§8)

**Contracts** (interfaces) that open to the outside world. Implementations (adapters) live under
`shared/adapters/`, on the outermost layer, and are **plugged in** via DI. The domain depends on these
ports, not on a concrete provider → if the provider changes, the code doesn't.

| Port | Adapter (planned) | Related decision |
|---|---|---|
| `LlmTextPort` / `LlmVisionPort` | OpenAI / Gemini | §8 AI architecture |
| `PaymentsPort` | iyzico | §7 payments |
| `StoragePort` | Cloudflare R2 | §8 storage |
| `EmailPort` | Postmark | §8 email |
| `JobQueuePort` | **MVP:** Render Cron + jobs table · **Phase 2:** BullMQ+Redis | §7/§8 queue |

For now only the contracts are defined; adapters are added as the relevant modules are developed.
