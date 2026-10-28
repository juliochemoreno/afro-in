# Execution report — D10 product photos in local dev

No formal plan file was written for this item (the work list's D10 entry was the spec), so there is nothing to archive in `.agents/plans/done/` and no unchecked boxes.

## What was built
- `wrangler.json`: `env.local` with `MEDIA` → `afroin-media-preview` (`remote: true`), local D1, Maps var. Selected by `platformProxy.environment: "local"` in `astro.config.mjs`.
- `seeds/local.sql`: 8 `product_images` rows (catalog data) for the local D1.
- Docs: orchestrator rule 9 and the `seeds/local.sql` header say `--env local` is only for `astro dev` / `--local`.
- Code review: `.agents/code-reviews/d10-local-photos.md`.

## Divergences
- `@astrojs/cloudflare` 12.6 passes `platformProxy` straight to `getPlatformProxy`, which supports `remote: true` and `environment` in wrangler 4.149, so no adapter change was needed.
- The first version reused the production D1 id in `env.local`; the orchestrator's review replaced it with a placeholder id (`f57428b`) so `--remote` or `deploy --env local` cannot reach production. Julio chose this and the local sqlite was copied to the new state file name.
- The worktree's `node_modules` had wrangler 4.21.2; `npm ci` aligned it to the lockfile (4.149.0), no new dependencies.

## Problems found
- The local D1 of a fresh checkout is empty and has no `product_images`; fixed by the seed.
- Astro has no `--env-file`; credentials must be in the process environment (`set -a; . <main>/.env; set +a`).
- A stray empty `rangler.json` appeared from a mistyped `sed -i`; removed, never committed.

## Validation
`npm run check` exit 0; `astro dev`: `/tienda` and `/tienda/camiseta-palenque-2020` 200, `/media/products/...` 200 `image/webp`; `.dev.vars` still loaded; `--remote --env local` fails; production dry-run still binds `afroin` and `afroin-media`.

## Commits
798516a feat · f57428b fix (placeholder D1 id) · e8eb685 code review.
