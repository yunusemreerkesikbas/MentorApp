# Credential-free closed-AI startup

Date: 2026-10-30. Owner direction: AI/photo classification is unused and must remain closed;
do not request an unnecessary Gemini credential. Implementation stays in the original checkout
and uses the already selected inline execution method. The owner approved the written plan
and implementation in this chat on 2026-10-30.

## Decision

Reuse the existing disabled-provider pattern from payments: add `disabled` to `AI_PROVIDER`
and `VISION_PROVIDER`. The closed trial selects both. No OpenAI/Gemini key is required in
this mode, including with `NODE_ENV=production`. Both fields must select `disabled` together;
partial AI shutdown is outside this change. Existing local/test defaults remain `fake`.
Real providers continue to require their keys, and fake providers remain forbidden in production.

Alternatives considered:

- Relax validation solely because a DB flag is false: startup validation runs before DB
  configuration loads, and later flag changes could activate uncredentialed providers.
- Select the existing OpenAI vision adapter: removes the Gemini dependency but still requires
  an unused OpenAI credential and leaves no explicit credential-free closed deployment mode.

## Runtime boundary

One small `DisabledAiAdapter` implements the existing LLM and vision ports. Complete,
stream, embedding and image classification all throw the existing localized `AI_DISABLED`
404. It performs no fetch, content generation, classification or fake response.
The AI module explicitly selects this adapter for the two disabled provider values.
The existing privacy, budget and runtime kill-switch wrappers remain in place.

The registry treats `ai.enabled` as effectively false when the process uses disabled AI.
Reads and the admin listing agree even if a stored override is true. A write attempting
to enable that key is rejected with the existing invalid-config error before persistence
or events; writing false and unrelated configuration still work. This ensures the public
availability snapshot and existing feature access checks describe the closed deployment.
Changing the DB flag cannot reopen AI. Reopening requires a reviewed deployment selecting
real providers with their keys, then the existing flags, budgets and acceptance gates.

## Scope and verification

No schema, dependency, public API shape or frontend change. Keep admin, payments, SMS,
social and storage/email/origin protections intact. Update the closed-trial runbook,
environment example, feature timelines and the private local trial runtime file; never
add a dummy key or copy staging provider credentials. The optional paid Blueprint remains
its real-provider alternative and is not applied.

RED/GREEN tests cover credential-free production validation, mixed/unknown provider values,
retained real/fake-provider restrictions, all four denied operations, real Nest provider
selection and registry read/list/write behavior. A local isolated HTTP/Postgres smoke checks
startup without AI credentials, closed availability and preserved personal account access.
Use synthetic loopback data and no external provider calls. Preserve all existing owner edits.
Run affected suites, API typecheck/build/lint, then one fresh read-only review. A new exact
candidate must pass full CI before a hosted rehearsal; the prior successful SHA does not
certify this new behavior. Production publication, cloud secret upload and DNS remain later steps.
