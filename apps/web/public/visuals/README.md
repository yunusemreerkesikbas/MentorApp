# Visuals (subject soft-3D)

Drop approved WebP (or PNG) files here. Flat folder — **no domain subfolders**.

Runtime path: `/visuals/{filename}`

## Naming

| File | Use |
|---|---|
| `plan-empty.webp` | Plan empty / nudge |
| `analiz-empty.webp` | Analiz chart / list empty |
| `bilgi-category.webp` | Knowledge category thumb (optional) |

Prefer WebP, transparent or light ground, soft-3D matching Puhu lighting (pastel matte, soft shadow).
Keep files lean (~200KB target).

## Wiring

Use `EmptyState` (`apps/web/src/components/empty-state.tsx`) with `visualSrc="/visuals/…"`.
Missing file → component shows a pastel placeholder; layout does not break.

Puhu companions stay under `/mascot/puhu/` — do not mix character variants into this folder.
