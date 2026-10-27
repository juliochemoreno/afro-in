# Orchestrator — AFRO IN

> Read by `/hopla:orchestrator` at start-up. Only what is specific to this project goes here; the generic orchestrator rules live in the skill. Keep it short and current.

## Repos

| Repo | Path | Integration branch | Merge into integration |
|---|---|---|---|
| afro-in | `/Users/juliochemoreno/Projects/personal/afroin-web/afro-in` | `dev` | PR to `dev` + orchestrator merges with `--no-ff` |

Until D0 revives it, `dev` is stale (Jan 2026, 31 commits behind `main`): do not branch from it.

## Work list

- Path: `.agents/plans/2026-10-27-work-list.md` — the ONLY list. Update its *In flight* section when a worker starts or lands, and tick an item in the same commit that lands the work.
- Suggested order: D0 (dev environment) first, every later Level 5 runs on it → D1 (ticketing), with D5 beside it if files do not overlap → D2/D3 → D4.

## Workers

- Worktree base: `origin/dev` (after D0).
- Validation the worker reports: `npm run check` (astro build + tsc + wrangler dry-run) · curl matrix against `astro dev` (NOT `wrangler dev`: `MessageChannel is not defined` crash in the local worker runtime) · Level 5 on dev.afroin.org. No lint or unit tests exist (tests deferred, see work list).
- Extra rigor: money paths (Bold payments, store orders, tickets, donations, admin auth) → code review per phase + one fresh-context branch review before the PR, strongest model. UI-only items with a closed design → cheaper model.
- Model overrides: none.

## Release and deploy

- Integration → production: PR `dev` → `main`; Julio approves and merges.
- Deploys: Cloudflare Workers Builds (Julio's personal AFRO IN account) deploys automatically: `main` → afroin.org, `dev` → dev.afroin.org (once D0 lands). Merging to `main` IS a production deploy. Never deploy production by hand.
- Branch preview builds (if enabled) use the PRODUCTION bindings (D1, Bold keys): never test there as if it were a sandbox.
- Migrations: manual, numbered `migrations/NNNN_*.sql`, no tracking table. Dev: `--env dev --remote` (pre-approved). Production: Julio's OK, applied BEFORE merging the code that needs it, additive only (the old code keeps running for minutes against the new schema). Record each one in the work list's *Applied in production*.
- Checks before a release: list migrations not yet in production; confirm production uses the production Bold keys/webhook and dev the test ones.

## Approvals

| Action | Who approves |
|---|---|
| Merge a worker into `dev` (deploys dev) | orchestrator, after the worker's validation + its own `npm run check` on the merge + Level 5 on dev |
| Dev migrations and dev deploys | orchestrator (standing approval) |
| Release `dev` → `main` (production deploy) | Julio |
| Production migrations, production data, secrets and keys | Julio |
| Cloudflare dashboard, Bold panel, Google Cloud console | Julio (no agent access) |
| Product decisions | Julio only |

No CI: "CI green" is replaced by the worker's validation report plus the orchestrator's own `npm run check` on the merged result.

## Project-only rules

1. Prices are server-side: store and ticket checkout re-price every line from D1; the client price is never trusted. *Why: a buyer can edit the browser request.*
2. Every `/api/admin/*` endpoint calls `requireAdmin` itself. *Why: the middleware guards admin pages only, not API routes.*
3. Bold order ids carry their kind (`AFROIN-` donation, `AFROIN-ORD-`, `AFROIN-TIX-`); the single webhook routes by prefix; confirm targets stay whitelisted in `src/lib/bold.ts`.
4. Home pages stay static; live data goes in server islands (`server:defer`). *Why: SSR pages on Workers send `astro:assets` to the runtime `/_image` endpoint (no Sharp) and every optimized image 404s (June 2026 regression, 82a0571).*
5. Every public page ships in es/en/fr (`src/i18n/routes.ts`).
6. Migrations are numbered sequentially and additive-only in production; record each production one in the work list.
7. The dev environment never receives donors' or buyers' personal data: copy catalog data only (products, taxonomy, events) or seed fake rows.
8. Cloudflare: the site lives in Julio's personal AFRO IN account, which the HOPLA Cloudflare MCP tools cannot see. Use `wrangler` from this project; credentials come only from environment variables Julio sets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`): never write them to files or print them.
