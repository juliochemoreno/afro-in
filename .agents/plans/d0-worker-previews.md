# Plan: D0 — Dev environment on Cloudflare Worker Previews

## Overview
Give every non-`main` branch of `afro-in` its own Cloudflare Worker Preview bound to staging resources (D1 `afroin-preview`, R2 `afroin-media-preview`, Bold test keys), so the `dev` branch's Preview becomes the dev environment and later items (D1 ticketing) can be tested end to end without touching production. Production config, data, bucket and secrets stay exactly as they are.

## Requirements Summary
- Work item D0 of `.agents/plans/2026-10-27-work-list.md`; rules 1–8 of `.agents/orchestrator.md` apply (rule 7: no personal data in dev; rule 8: Cloudflare credentials only from env vars, never written or printed).
- Upgrade `wrangler` 4.21.2 → 4.149.0, range `4.149.x` (Julio approved 2026-10-27; 4.149.0 instead of the latest 4.154.0 because it is ≥ 14 days old — published 2026-10-08 — and already has Previews). `astro dev` and `npm run check` must keep working with `@astrojs/cloudflare` 12.6.0.
- `wrangler.json`: `preview_urls: true` + a `previews` block that rebinds `DB` and `MEDIA` to staging resources.
- New `wrangler.preview-migrations.jsonc` for the staging D1; apply migrations 0001–0007 there.
- Seed (Julio's decision): migrations 0001–0007 only (their 0004/0006 seed the 8 catalog products + taxonomy) **plus one fake product** `[DEV] Producto de prueba` that exists only in staging. Nothing is read from the production D1.
- Images (Julio's decision): copy only the 8 `products/*` objects referenced by the seeded catalog from `afroin-media` (read-only `get`) to `afroin-media-preview`.
- Previews stay public on `workers.dev` (Julio's decision; `workers.dev` Preview URLs send `X-Robots-Tag: noindex`). No Cloudflare Access now.
- Bold (Julio's decision): Bold **test** keys as Previews Base secrets, loaded by Julio himself; Bold test webhook → `dev` Preview URL; other branch Previews confirm via the browser-return path (`/api/bold-confirmar`, `/api/store/confirm`).
- Admin (Julio's decision): new dev-only `ADMIN_USER` / `ADMIN_PASSWORD`, loaded by Julio as Base secrets.
- Proof: this branch's Preview shows the fake product (staging-only row) and production `afroin.org` still does not; production deployment unchanged.
- Workflow classification: `sequential user-driven` (operator steps: create resources → migrate → seed → deploy → verify). No reactive effects.

## Out of Scope
- Dashboard actions (Julio only): one-time switch to Worker Previews, enabling preview builds, Base secrets, Bold panel webhook, optional custom domain / Access.
- Migrations 0008–0010 (ticketing): not on this branch. Verified: `ls migrations` → `0001…0007` only; 0008–0009 live on `feature/event-ticketing`, 0010 in `git stash`. D1 applies them to staging (pre-approved) when it lands.
- Preview `vars`: production has no `vars` (verified `wrangler.json`, no `vars` key) and no code reads an environment flag, so `previews.vars` is not added (work list mentioned "preview vars"; nothing needs one).
- `worker-configuration.d.ts`: no new binding names (DB, MEDIA unchanged), so it is not regenerated unless `npm run check` fails after the upgrade.
- Custom domain `dev.afroin.org`: Worker Previews custom domains are wildcard hosts (`<preview>.<host>`), so `dev.afroin.org` would only exist by enabling previews on `afroin.org` itself (every branch → `<branch>.afroin.org`). Left for Julio to decide later.
- Production deploy of this change: happens only when Julio releases `dev` → `main`.

## Likely Follow-ups
- D1 applies 0008–0010 to the staging D1 with `wrangler.preview-migrations.jsonc`.
- Cloudflare Access on Previews (custom domain or workers.dev) if Julio wants them private.
- Custom domain for Previews (e.g. `preview.afroin.org` → `dev.preview.afroin.org`).
- O3 `ASTRO_KEY` build variable (affects Preview builds too).

## Git Strategy
- **Base branch:** `dev` (cut at f611f19 = `main` 12d627b + orchestrator files; verified `git merge-base --is-ancestor origin/main origin/dev` → true). `origin/dev` has since moved to 408f02b (work-list *In flight* + O1 only): merge `origin/dev` into the branch before opening the PR.
- **Feature branch:** `claude/d0-worker-previews-a96ae4` (this worktree; one branch, one PR to `dev`).

## Context References
- `.agents/orchestrator.md` — rules 1–8, approvals table (staging D1 migrations + Preview deploys are pre-approved; production is Julio's).
- `.agents/plans/2026-10-27-work-list.md` — item D0 (tick sub-steps in the landing commit).
- `wrangler.json` — today: `name: afro-in`, `account_id 5d061cd2…`, `d1_databases[DB → afroin 1a752558-…]`, `r2_buckets[MEDIA → afroin-media]`, no `vars`, no `workers_dev`/`preview_urls`.
- `package.json` — `devDependencies.wrangler: "4.21.x"`; `check` = `astro build && tsc && wrangler deploy --dry-run`; `dev` = `astro dev`.
- `astro.config.mjs:53-58` — adapter `cloudflare({ imageService: "compile", platformProxy: { enabled: true } })`; `astro dev` reads `wrangler.json` through wrangler's `getPlatformProxy` → the upgrade changes this path (must re-verify).
- `node_modules/@astrojs/cloudflare/package.json` — depends on `wrangler ^4.14.1` (so 4.149 satisfies it).
- `src/pages/tienda/index.astro:2`, `src/pages/tienda/[slug].astro:2` — `prerender = false`, read products from D1 (`src/lib/products.ts:222-239`, `WHERE visible = 1`, by slug) → the proof surface.
- `src/pages/media/[...key].ts:17` — serves `/media/<r2_key>` from `env.MEDIA` → image copy check.
- `migrations/0004_seed_products.sql` — 8 products, image keys `products/<slug>/main.(webp|jpeg)`; starts with `DELETE FROM product_images; DELETE FROM products;`.
- `migrations/0003_create_products.sql`, `0005_create_taxonomy.sql:40` — `products` columns (slug, sku UNIQUE, name_*, price INTEGER, visible, featured, sort_order, `category_id` added in 0005).
- `src/components/CheckoutForm.tsx:160-162` — Bold `redirectionUrl = window.location.origin + successPath` → return path works on any Preview host (no hardcoded `afroin.org`; verified `grep -rn "afroin.org" src/pages/api src/lib` → 0 hits).
- Env names used by code (`grep -rn -E "env\.|runtime\.env" src`): `DB`, `MEDIA`, `BOLD_API_KEY`, `BOLD_SECRET_KEY`, `ADMIN_USER`, `ADMIN_PASSWORD`.
- Docs read (2026-10-27, `index.md` versions): developers.cloudflare.com/workers/previews/ , /get-started/ , /configuration/ , /resources/ , /custom-domains/ , /workers/ci-cd/builds/build-branches/.

### Verified platform facts (spikes run while planning)
- Credentials: wrangler's own login is HOPLA OAuth (wrong account). The AFRO IN token + account id live in the main checkout's gitignored `.env` (names only checked: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `ASTRO_KEY`, `PUBLIC_GOOGLE_MAPS_API_KEY`). Loading it into the process only: `( set -a; . <main>/.env; set +a; npx wrangler whoami )` → `Afroinsantamarta@gmail.com's Account │ 5d061cd2e8e41dd336d678070802ffaf` (= `wrangler.json` account_id). Wrangler 4.149 also has a global `--env-file <path>` flag (spike below).
- Existing resources (`wrangler d1 list`, `wrangler r2 bucket list`): only `afroin` (D1, production) and `afroin-media` (R2, production). Staging resources do not exist yet.
- Worker URL settings (`GET /accounts/:id/workers/scripts/afro-in/subdomain`): `{"enabled": true, "previews_enabled": true}`; account subdomain `afroinsantamarta`. Preview URL shape: `<preview-name>-afro-in.afroinsantamarta.workers.dev`.
- Workers Builds API with this token: `GET /builds/workers/<tag>/triggers` → `12006 Invalid token` → the build config cannot be read or changed by the agent; Julio checks it in the dashboard.
- `npx wrangler@4.149.0 preview --help` (npx cache, outside the project) → `wrangler preview [script]`, `preview delete`, `preview secret` (`put|delete|list|bulk`), `preview base-config secret` (`put|delete|list|bulk`); options `--name` (defaults to git branch), `--json`, `--secrets-file`, global `--env-file`. `npm view wrangler time` → 4.149.0 published 2026-10-08T18:24Z.
- Docs: Base secrets set later apply only to **new** Previews; an existing Preview needs `wrangler preview secret put X --name <preview>`.
- Docs: the switch of an existing Builds-connected Worker to Worker Previews is **irreversible** (affects preview builds only; production deploys unchanged).

## Domain Assumptions

Confirmed by Julio 2026-10-27 (relayed verbatim by the orchestrator: "Confirmo los 3 supuestos.").

- The fake product is visible in the Preview store (`visible = 1`, `featured = 0`, price 1000 COP = Bold minimum) so it can double as the cheapest Bold test purchase — confirmed.
- "Catalog images" = exactly the 8 `products/*` keys referenced by `migrations/0004_seed_products.sql`; no other objects are copied — confirmed.
- The `dev` Preview is the only target of the Bold test webhook; other branch Previews rely on the browser return — confirmed.

## Migration
- **Type / scope / downtime / driver:** dependency upgrade (wrangler, devDependency only) + deploy-config change; whole repo; no downtime (production is untouched until Julio's release); driver: Worker Previews require ≥ 4.135.0; target 4.149.0 (≥ 14 days old).
- **Strategy:** big bang (one devDependency, three scripts use it) — trade-off: no adapter needed; if 4.149 breaks `astro dev`, revert the lockfile.
- **Inventory:** `grep -n wrangler package.json` → 4 hits (devDependency, `cf-typegen`, `check`, `deploy`, `preview` scripts); `@astrojs/cloudflare` uses wrangler's `getPlatformProxy` in `astro dev`; Workers Builds uses the branch's lockfile.
- **Upgrade notes:** registry: `npm view wrangler version` → `4.154.0` (published 2026-10-27, too new); chosen `4.149.0` (published 2026-10-08). Previews docs: "Worker Previews requires Wrangler 4.135.0 or later. Update the project dependency". No migration guide for 4.x minors; risk is in `getPlatformProxy`/miniflare (Task 1 verifies).

## Implementation Tasks

> Helper used below (scratchpad, not committed): `WR` = `npx wrangler --env-file /Users/juliochemoreno/Projects/personal/afroin-web/afro-in/.env` (after Task 1; before it, source the file in a subshell). Never echo the file or the variables.

### Task 1: Upgrade wrangler to 4.149.0 and verify local dev
- **Action:** modify
- **File:** `package.json`, `package-lock.json`
- **Pattern:** keep the existing `"4.21.x"` style → `"4.149.x"`
- **Details:** `npm i -D wrangler@4.149.0`, then set the range to `4.149.x`. Run `npm run check`; start `astro dev` and curl `/`, `/tienda`, `/api/contador` on `localhost:4321` (local D1; the worktree has no `.dev.vars`, so Bold endpoints may 500 "not configured" — expected).
- **Gotcha:** `wrangler deploy --dry-run` now validates the config: run it again after Task 3. If `astro dev` breaks (`getPlatformProxy`/miniflare), stop and report before going on.
- **Validate:** `npx wrangler --version` → 4.149.0; `npm run check` exit 0; curl matrix 200 on `/`, `/tienda`.
- **Time-box:** 30 min. Fallback: stop and report; do not move to another version on your own (Julio decides; any candidate must be ≥ 14 days old and ≥ 4.135.0).

### Task 2: Create the staging resources
- **Action:** create (Cloudflare resources)
- **File:** N/A (account `5d061cd2…`)
- **Pattern:** N/A
- **Details:** `WR d1 create afroin-preview` (record the `database_id`); `WR r2 bucket create afroin-media-preview`.
- **Gotcha:** names must not collide with production (`afroin`, `afroin-media`). Never run any write against those two.
- **Validate:** `WR d1 list`, `WR r2 bucket list` show both new resources next to the unchanged production ones.

### Task 3: Add `preview_urls` and the `previews` block
- **Action:** modify
- **File:** `wrangler.json`
- **Pattern:** docs `/workers/previews/configuration/` example
- **Details:** add `"preview_urls": true` and `"previews": { "d1_databases": [{ "binding": "DB", "database_name": "afroin-preview", "database_id": "<from Task 2>" }], "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "afroin-media-preview" }] }`. Top-level (production) keys unchanged.
- **Gotcha:** `assets`, `compatibility_*` stay top-level only. `observability` top-level applies to Previews. Database ids are not secrets (already committed for production).
- **Validate:** `npm run check` exit 0 (dry-run validates the block); `git diff wrangler.json` touches only the two new keys.

### Task 4: Migrations config for the staging D1
- **Action:** create
- **File:** `wrangler.preview-migrations.jsonc`
- **Pattern:** docs `/workers/previews/resources/#d1-migrations` step 2
- **Details:** `{ "d1_databases": [{ "binding": "PREVIEW_DB", "database_name": "afroin-preview", "database_id": "<same id>", "migrations_dir": "migrations" }] }` plus `account_id` (so it never falls back to another account) and a comment explaining it targets staging only.
- **Gotcha:** must point to the same physical DB as `previews.d1_databases`; never to `afroin`.
- **Validate:** `WR d1 migrations list PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc` lists 0001–0007 as pending.

### Task 5: Apply migrations 0001–0007 to staging
- **Action:** N/A (remote staging D1)
- **File:** N/A
- **Pattern:** docs step 5
- **Details:** `WR d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc`.
- **Gotcha:** creates a `d1_migrations` tracking table in staging only (production has none — not touched).
- **Validate:** `WR d1 execute PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --command "SELECT COUNT(*) FROM products"` → 8.

### Task 6: Staging-only seed with the fake product
- **Action:** create
- **File:** `seeds/preview.sql`
- **Pattern:** `migrations/0004_seed_products.sql` insert style
- **Details:** header comment "staging D1 only, never production"; `INSERT OR IGNORE INTO products (slug, sku, name_es, name_en, name_fr, description_*, category_*, price, in_stock, featured, visible, sort_order, category_id) VALUES ('dev-producto-de-prueba', 'DEV-TEST-0001', '[DEV] Producto de prueba', '[DEV] Test product', '[DEV] Produit de test', …, 1000, 1, 0, 1, 99, (SELECT id FROM categories WHERE slug='accesorios'));` No image row (store must handle a product without images — check `src/lib/products.ts` first; if it breaks, add an image row reusing an existing seeded key). Apply with `WR d1 execute PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --file seeds/preview.sql`.
- **Gotcha:** outside `migrations/` on purpose so no migration run ever sends it to production.
- **Validate:** `SELECT slug FROM products WHERE slug='dev-producto-de-prueba'` → 1 row in staging.

### Task 7: Copy the 8 catalog images to the staging bucket
- **Action:** N/A (R2 objects)
- **File:** N/A
- **Pattern:** N/A
- **Details:** for each key in `0004` (`grep -o "products/[^']*" migrations/0004_seed_products.sql`): `WR r2 object get afroin-media/<key> --remote --file <scratchpad>/<key>` (read-only), then `WR r2 object put afroin-media-preview/<key> --remote --file … --content-type <type>`.
- **Gotcha:** production bucket: `get` only. Missing objects → report, do not invent.
- **Validate:** `WR r2 object get afroin-media-preview/<key> --remote --pipe | wc -c` > 0 for each key.

### Task 8: Document local secrets for Bold
- **Action:** modify
- **File:** `.dev.vars.example`
- **Pattern:** existing file
- **Details:** add `BOLD_API_KEY=""` / `BOLD_SECRET_KEY=""` with a comment "Bold TEST keys only for local and Previews".
- **Gotcha:** placeholders only, no values.
- **Validate:** `git diff .dev.vars.example` shows only empty placeholders.

### Task 9: Deploy this branch's Preview and prove isolation
- **Action:** N/A (Preview deploy, pre-approved)
- **File:** N/A
- **Pattern:** docs get-started step 2
- **Details:** first re-check with the project's wrangler: `npx wrangler preview --help` lists `preview secret`, `preview base-config` and `--secrets-file` (if anything is missing, stop and report the first ≥ 14-day-old version that has it; do not upgrade on your own). Then `npm run build && WR preview --name d0-worker-previews --json`. Then: `curl -s <preview>/tienda | grep -c "\[DEV\] Producto de prueba"` ≥ 1; `curl -s -o /dev/null -w "%{http_code}" <preview>/tienda/dev-producto-de-prueba` → 200; same on `https://afroin.org` → 0 matches / 404; one image `curl -I <preview>/media/products/...` → 200; `curl -sI <preview>/` has `x-robots-tag: noindex`. Production unchanged: `GET /workers/scripts` `modified_on` and `WR deployments list` latest production deployment id identical before/after.
- **Gotcha:** if the CLI refuses because the Worker is still on the old Builds preview model, stop: Julio does the dashboard switch first, then retry. Base secrets set after this Preview exists do not reach it (`preview secret put --name d0-worker-previews` instead).
- **Validate:** the curl outputs above, pasted in the report.
- **Time-box:** 30 min; fallback: report the CLI error and wait for Julio's switch.

### Task 10: Record the dev environment and tick D0
- **Action:** modify
- **File:** `.agents/orchestrator.md`, `.agents/plans/2026-10-27-work-list.md`
- **Pattern:** existing bullets
- **Details:** orchestrator *Release and deploy*: staging resource names, migration command, seed command, preview URL shape; drop the "Until D0 revives it, dev is stale" note. Work list: tick done D0 sub-steps (incl. "dev = main" f611f19), leave the dashboard ones open for Julio.
- **Gotcha:** `In flight` belongs to the orchestrator: do not edit it.
- **Validate:** `git diff .agents/` reviewed.

## Test Tasks
- No test framework exists (work list: tests deferred). Verification is the `npm run check` + curl matrices in Tasks 1 and 9.
- Regression: after the upgrade, curl `astro dev` on `/`, `/en/`, `/tienda`, `/api/contador` (existing behavior) — Task 1.

## Phase Boundaries
- **Commit A** (`chore(deps): upgrade wrangler to 4.149 for Worker Previews`): Task 1. Rollback: revert the commit.
- **Commit B** (`chore(previews): bind Worker Previews to staging D1 and R2`): Tasks 3, 4, 6, 8. Rollback: revert; the staging D1/R2 can be deleted (created by this session).
- **Commit C** (`chore(agents): record dev environment, tick D0`): Task 10.
- Tasks 2, 5, 7, 9 are remote operations on staging resources only (no commit).

## Validation Checklist
- [ ] **Level 1 — Lint & Format:** N/A (no linter in the project).
- [ ] **Level 2 — Type Check / build:** `npm run check`
- [ ] **Level 2.5 — Code Review:** `code-review` skill on the branch diff (config + seed + docs).
- [ ] **Level 3 — Unit Tests:** N/A (none exist).
- [ ] **Level 4 — Integration:** curl matrix against `astro dev` (Task 1) and against the branch Preview + `afroin.org` (Task 9).
- [ ] **Level 5 — Human Review (Julio, before the orchestrator merges into `dev`):** (a) dashboard switch to Worker Previews done and preview builds enabled — otherwise pushes keep building old-model previews with PRODUCTION bindings; (b) Base secrets loaded (Bold test keys, dev admin) — otherwise dev checkout/admin answer "not configured"; (c) Bold test webhook → `dev` Preview URL `/api/bold-webhook` — otherwise dev payments confirm only via the browser return. Skipping (a) means Preview builds from Builds are not isolated.

## Acceptance Criteria
- [ ] `wrangler` 4.149.x in `package.json` (4.149.0 in the lockfile); `npm run check` passes; `astro dev` serves `/` and `/tienda`.
- [ ] `wrangler.json` has `preview_urls: true` and `previews` binding `DB`→`afroin-preview`, `MEDIA`→`afroin-media-preview`; production keys unchanged.
- [ ] Staging D1 has 0001–0007 + the fake product; staging R2 has the 8 catalog images.
- [ ] The branch Preview shows `[DEV] Producto de prueba`; `afroin.org` does not; production deployment id unchanged.
- [ ] Julio has exact dashboard/secret/Bold instructions (PR body).

## Confidence Score: 7/10
- **Strengths:** docs read in full; account, resources and URL settings verified; production untouched by design.
- **Uncertainties:** `getPlatformProxy` behavior after a 128-minor jump; whether `wrangler preview` works before the dashboard switch; whether `wrangler deploy --dry-run` accepts the block with the Astro adapter's entry.
- **Mitigations:** Task 1/9 time-boxes with explicit stop-and-report fallbacks.

## Notes for Executing Agent
- Never print or write `CLOUDFLARE_API_TOKEN`; use `--env-file` pointing at the main checkout's `.env`. Never write to `afroin` (D1) or `afroin-media` (R2); `r2 object get` on production is the only allowed production access (Julio's choice).
- Julio does every dashboard and Bold step; give exact steps, warn that the switch is irreversible.
- Before the PR: `git merge origin/dev` (it moved to 408f02b; Task 10 touches other lines of the work list).
- Report: branch, SHAs, validation, Preview URL, code-review artifact, Julio's pending dashboard steps.
