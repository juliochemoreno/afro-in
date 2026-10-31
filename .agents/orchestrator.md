# Orchestrator — AFRO IN

> Read by `/hopla:orchestrator` at start-up. Only what is specific to this project goes here; the generic orchestrator rules live in the skill. Keep it short and current.

## Repos

| Repo | Path | Integration branch | Merge into integration |
|---|---|---|---|
| afro-in | `/Users/juliochemoreno/Projects/personal/afroin-web/afro-in` | `dev` | PR to `dev` + orchestrator merges with `--no-ff` |

`dev` was revived from `main` on 2026-10-27 (73accfb).

## Work list

- Path: `.agents/plans/2026-10-27-work-list.md` — the ONLY list. Update its *In flight* section when a worker starts or lands, and tick an item in the same commit that lands the work.
- Suggested order: D0 (dev environment) first, every later Level 5 runs on it → D1 (ticketing) → D5 (after D0: both may touch dependencies) → D2/D3 → D4.

## Workers

- Worktree base: `origin/dev` (after D0).
- Validation the worker reports: `npm run check` (astro build + tsc + wrangler dry-run) · curl matrix against `astro dev` (NOT `wrangler dev`: `MessageChannel is not defined` crash in the local worker runtime) · Level 5 on the branch's Worker Preview URL. No lint or unit tests exist (tests deferred, see work list).
- Extra rigor: money paths (Bold payments, store orders, tickets, donations, admin auth) → code review per phase + one fresh-context branch review before the PR, strongest model. UI-only items with a closed design → cheaper model.
- Model overrides: none.

## Release and deploy

- Integration → production: PR `dev` → `main`; Julio approves and merges.
- Deploys: Cloudflare Workers Builds (Julio's personal AFRO IN account) deploys automatically: `main` → afroin.org. Every other branch → its own Worker Preview at `https://<preview-name>.afroin.org` and `https://<preview-name>-afro-in.afroinsantamarta.workers.dev` (the `dev` branch → `dev.afroin.org`) (the name is the branch sanitized for a hostname; Builds and `wrangler preview` print the real URL). Bindings come from `wrangler.json` → `previews` (D1 `afroin-preview`, R2 `afroin-media-preview`); secrets from the Previews Base config, copied only into Previews created AFTER they are set (an existing Preview needs `npx wrangler preview secret put <KEY> --name <preview>`). The `dev` branch's Preview is the dev environment. Manual Preview deploy: `npm run build && npx wrangler preview --name <name>`, with the AFRO IN credentials loaded (`--env-file=<main checkout>/.env` from a worktree; the local wrangler login is HOPLA's account). Merging to `main` IS a production deploy. Never deploy production by hand.
- Until D0's one-time dashboard switch to Worker Previews, branch preview builds (if enabled) use the PRODUCTION bindings (D1, Bold keys): never test there as if it were a sandbox.
- Migrations: manual, numbered `migrations/NNNN_*.sql`, no tracking table. Staging D1 shared by all Previews: `npx wrangler d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc` (pre-approved; tracked in its `d1_migrations` table); fake staging-only rows: `seeds/preview.sql` (same config, `d1 execute --file`). NEVER run `d1 migrations apply` without `--config wrangler.preview-migrations.jsonc`: `wrangler.json` points at production, which has no tracking table, so every migration would run there (0004 starts with `DELETE FROM products`). Production: Julio's OK, applied BEFORE merging the code that needs it, additive only (the old code keeps running for minutes against the new schema). Record each one in the work list's *Applied in production*.
- Checks before a release: list migrations not yet in production; confirm production uses the production Bold keys/webhook and dev the test ones; confirm `main` contains everything production serves today (see the work list's *Production state*: production ran a manual deploy that was not in git).

## Approvals

| Action | Who approves |
|---|---|
| Merge a worker into `dev` (updates the dev Preview) | orchestrator, after the worker's validation + its own `npm run check` on the merge + Level 5 on the branch's Preview |
| Staging D1 migrations and Preview deploys | orchestrator (standing approval) |
| Release `dev` → `main` (production deploy) | Julio |
| Production migrations, production data, secrets and keys | Julio |
| Cloudflare dashboard, Bold panel, Google Cloud console | Julio (no agent access) |
| Product decisions | Julio only |

No CI: "CI green" is replaced by the worker's validation report plus the orchestrator's own `npm run check` on the merged result.

## Project-only rules

1. Prices are server-side: store and ticket checkout re-price every line from D1; the client price is never trusted. *Why: a buyer can edit the browser request.*
2. Every `/api/admin/*` endpoint calls `requireAdmin` itself. *Why: the middleware guards admin pages only, not API routes.*
3. Bold order ids carry their kind (`AFROIN-` donation, `AFROIN-ORD-`, `AFROIN-TIX-`); the single webhook routes by prefix; confirm targets stay whitelisted in `src/lib/bold.ts`.
4. Home pages stay static; live data goes in server islands (`server:defer`). *Why: SSR pages on Workers send `astro:assets` to the runtime `/_image` endpoint (no Sharp) and every optimized image 404s (June 2026 regression, 429aee7).*
5. Every public page ships in es/en/fr (`src/i18n/routes.ts`).
6. Migrations are numbered sequentially and additive-only in production; record each production one in the work list.
7. The dev environment never receives donors' or buyers' personal data: copy catalog data only (products, taxonomy, events) or seed fake rows.
8. Cloudflare: the site lives in Julio's personal AFRO IN account, which the HOPLA Cloudflare MCP tools cannot see. Use `wrangler` from this project; credentials come only from environment variables Julio sets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`): never write them to files or print them. From a worktree, pass `--env-file=<main checkout>/.env` AFTER the command (`npx wrangler d1 list --env-file=…`); before it, the flag swallows the command. Create resources with `--update-config=false` and edit `wrangler.json` by hand: staging resources go in the `previews` block, never in the top-level production bindings.
9. `--env local` (`wrangler.json`) is only for `astro dev` and `wrangler d1 execute --local`: its `MEDIA` reads the staging bucket remotely and its D1 id is a placeholder. Never use it with `--remote`, `deploy` or `preview`. Local setup: apply `migrations/*.sql` then `seeds/local.sql` with `--local --env local`; run `astro dev` with the Cloudflare credentials in the environment.
10. Component `<script>` blocks that touch the DOM run inside a function registered with `document.addEventListener("astro:page-load", fn)`. *Why: the layout uses `<ClientRouter />`; a bare top-level script only runs on the first full page load (D16 review finding).*
11. Full-bleed layouts (photos that bleed past the content column) derive the distance to the screen edge from the container (`100cqw`, with `container-type: inline-size` on the page root), never from `100vw`. *Why: `100vw` includes the scrollbar and misaligns text by its width (D16).*
