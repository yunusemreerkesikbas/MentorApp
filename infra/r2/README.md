# infra/r2

CORS policies for the two R2 buckets, kept in git so a change is reviewable in a PR instead of
being pasted into a dashboard and forgotten.

```bash
npx wrangler r2 bucket cors set mentor-public  --file infra/r2/cors-public.json
npx wrangler r2 bucket cors set mentor-private --file infra/r2/cors-private.json
npx wrangler r2 bucket cors list mentor-public
```

Replace the `mentor.example` origins with the real ones before applying. `wrangler` is not a
dependency — `npx` fetches it, and you authenticate once with `npx wrangler login`.

**These files use the Wrangler schema, not the dashboard one.** R2 accepts two different shapes for
the same policy and it is an easy trap:

| Where | Shape |
|---|---|
| `wrangler r2 bucket cors set --file` (these files) | `{ "rules": [ { "allowed": { "origins", "methods", "headers" }, "exposeHeaders", "maxAgeSeconds" } ] }` |
| Dashboard → bucket → Settings → CORS Policy → JSON | S3-style array: `[ { "AllowedOrigins", "AllowedMethods", "AllowedHeaders", "ExposeHeaders", "MaxAgeSeconds" } ]` |

Pasting one into the other fails. `cors list` prints the applied policy, so use it to confirm.

**Why the private bucket needs CORS at all:** exam photos are uploaded browser→R2 with a presigned
PUT. Presigned URLs carry their own authentication, but the browser still enforces CORS on the
request, so without a policy the upload fails even though the URL is valid. It gets `PUT` only —
never `GET`, because nothing may read those objects from a page.

Full setup: [`docs/core/storage-r2.md`](../../docs/core/storage-r2.md).
Verify with `pnpm --filter @mentor/api storage:check`.
