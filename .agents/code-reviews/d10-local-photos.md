# Code review — D10 local photos (origin/dev..HEAD)

Effort: medium (native review ran, high-effort recall pass) · project checklist: none found (`.agents/guides/review-checklist.md` absent) · kept 2 / dropped 3

Verified by hand: `.dev.vars` still loads with `environment: "local"` (getPlatformProxy test); `--remote --env local` fails against the placeholder D1 id; `wrangler deploy --dry-run` still binds `afroin` + `afroin-media`; `astro dev` serves `/tienda` and `/media/products/...` (200, image/webp).

## Kept

severity: medium
confidence: 85
source: native
file: astro.config.mjs
line: 56
issue: `astro dev` now requires valid Cloudflare credentials for every page, not only photos
detail: The remote proxy session starts in the `astro:server:setup` hook; without `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` the hook throws and the dev server does not serve anything (reproduced with the wrong account's login).
suggestion: Accepted trade-off of the decision (documented in work list, orchestrator.md rule 9). If it hurts, set `remoteBindings: false` via an env var for offline work.

severity: medium
confidence: 80
source: native
file: wrangler.json
line: 53
issue: Writes from local dev go to the shared staging bucket
detail: `src/pages/api/admin/products/upload.ts` and delete paths use `MEDIA` read/write; with the remote binding they change objects in `afroin-media-preview`, shared by every Worker Preview and every parallel worker.
suggestion: Accepted per Julio's decision; keep catalog-only data there. Do not test destructive admin flows against it.

## Dropped (low confidence)

- wrangler.json:36 — Maps key duplicated in `env.local.vars` (confidence 30, public restricted key; orchestrator OK'd)
- seeds/local.sql:7 — hardcoded rows can drift from staging (confidence 40)
- wrangler.json — `wrangler deploy` warns about multiple environments (confidence 20, harmless, deploys top level)
