# Existing community question detail advertising

Approved scope: add one lazy display slot after answers on the existing authenticated community question detail. No new page and no announcement/feed/profile/chat placement.

## Implementation contract

- Introduce authenticated-only `community.question.end`, with a default-off audited enable flag and empty Google unit. Existing country, Premium/STAFF and strictest exam audience policy remains.
- Preserve public text approval. Add three nullable columns to the existing Ads approval table for an independent community snapshot revision/reviewer/time. Community approval requires a currently approved public text revision. Public reapproval/revocation clears community approval; community revocation leaves public approval intact.
- Forum owns a page-context service that assembles the actual question, answers and current viewer's existing relevant waiting-question rail. The detail response supplies that rail so the client renders the same snapshot rather than making a second independent feed read.
- Snapshot only publisher content: question/answer text, participants' display identity/avatar, attachments, visible tags, zone breadcrumb and waiting-question text/identity/zone. Exclude private viewer state and action counters. Verify every involved zone is public and active in one batched repository read. Private coach context, unsupported inline Markdown media, failed rail reads or mismatched public/detail content fail closed. They retain the existing normal reading UI without an ad.
- Admin's existing question review section gets a separate community preview with every public identity/image/attachment and recommendation visible to that reviewer. The submitted revision must match a freshly read snapshot. Different viewers' recommendations can differ: an approval only covers an exactly matching snapshot; changing recommendations requires review again.
- Ordinary page-context assembly is gated by the new placement flag. Admin preview works before activation. No extra reads while the new placement is off. A failed ad-context read must not break question reading.
- Do not mount the ad when personal editing/dialog interaction starts; cancel a pending request and remove a filled slot. Suppression lasts for that question visit, with no automatic refresh. On content revision changes replace the old slot immediately. Preserve answering, accepting, saving and existing rail behavior.

## Steps

1. Write failing tests for public/detail consistency, identity/media/tag/rail revision changes, private/unsupported contexts and independent approvals.
2. Add shared snapshot contracts, Forum page-context builder/service, additive nullable approval columns and scoped review operations; generate the forward-only migration.
3. Wire audited community review endpoints and the existing admin panel; add authenticated placement policy and defaults.
4. Integrate the existing question detail and rail, extract answer rendering if needed to keep the shell manageable, and add the lazy interaction-aware ad component.
5. Run scoped unit/real-DB/browser checks (desktop/mobile/320px, revision changes, privacy interaction, no-fill/error, entitlement); independent read-only review; update feature/API/integration docs and roadmap. Full CI remains a merge gate, production remains off.

No sponsor system, provider abstraction, user-level impression ledger or production activation is included.

## Verification and delivery

- Implemented the existing-screen placement, independent audited review, nullable approval fields,
  server-owned rail and interaction teardown. Independent read-only review found an attachment
  interaction gap; composer capture signals now remove the ad before file/emoji drafting. Recheck
  found no remaining actionable issue. Closed/inert room drawers do not suppress normal reading ads.
- Scoped checks: 132 unique API unit tests (113 Ads/config regression tests plus 19 Forum snapshot/
  page-context tests), eight real-Postgres API tests, seven web unit tests and 34 desktop/mobile
  browser tests passed. Browser checks include 320px size filtering, no-fill/blocking, unavailable
  context, pending callback cancellation, drafting/files/emoji/dialogs, content revision changes,
  subscription changes, lazy loading and English labels. Browser fixtures use synthetic content
  and GPT; they do not demonstrate real inventory approval or revenue.
- Shared packages compile; API/web/admin type checks and targeted lint passed. Full workspace CI
  has not run and remains required before merge/release.
- Migration `0130` applied to the test database and verified localhost `mentor` development
  database only. The development database had exactly this one pending migration. No flags
  changed; production migration/activation remain deployment steps.
