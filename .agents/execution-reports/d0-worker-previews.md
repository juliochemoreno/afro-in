# Execution Report — D0 Dev environment on Worker Previews

## Meta Information

- **Plan:** `d0-worker-previews`: `.agents/plans/d0-worker-previews.md` (→ `.agents/plans/done/d0-worker-previews.md` after archive)
- **PR:** https://github.com/juliochemoreno/afro-in/pull/2. Merged into `dev` as 3b3cab4.
- **Commits:** 848a7e4, f4ed0ce, d7200c0 (merge `origin/dev`), 623a73f, b71cc22, 9647f25
- **Files added:** `wrangler.preview-migrations.jsonc`, `seeds/preview.sql`, `.agents/plans/d0-worker-previews.md`, `.agents/code-reviews/d0-worker-previews.md`
- **Files modified:** `package.json`, `package-lock.json`, `wrangler.json`, `.dev.vars.example`, `.agents/orchestrator.md`, `.agents/plans/2026-10-27-work-list.md`
- **Lines changed:** +1225 −361 (+317 −12 without `package-lock.json`)
- **Remote resources created (AFRO IN account):** D1 `afroin-preview` (e41ea281-e1e4-49b8-90f3-893fbf9463c1), R2 `afroin-media-preview`, Preview `d0-worker-previews`

## Validation Results

- Syntax & Linting: Not applicable (no linter in the project)
- Type Checking: ✓ `npm run check` (astro build + tsc + `wrangler deploy --dry-run`) after the upgrade and after the `previews` block. The orchestrator re-ran it on the merge.
- Unit Tests: Not applicable (no test framework; tests deferred in the work list)
- Integration Tests: ✓
  - `astro dev`: `/`, `/en/`, `/tienda`, `/tienda/gorra-negra`, `/api/contador` → 200 (local D1 with 0001–0007).
  - Preview `d0-worker-previews`: `/tienda` shows `[DEV] Producto de prueba` (200); `/tienda/dev-producto-de-prueba` 200; `/media/products/gorra-negra/main.jpeg` 200 (118615 B, staging bucket); `/api/contador` `{"total":0,"totalAmount":0}`; `x-robots-tag: noindex`.
  - Production: afroin.org `/tienda` has 0 `[DEV]` matches; `/tienda/dev-producto-de-prueba` 302 → `/tienda`; the latest production deployment is still `e849149f` (version `1b2d975b`) before and after.

## Code Review Findings

- **Code review file:** `.agents/code-reviews/d0-worker-previews.md`
- **Issues found:** 0 critical, 1 high, 2 medium, 1 low kept; 1 dropped (low confidence)
- **Issues fixed before this report:** 4 (b71cc22)
- **Key findings:** The new docs pointed at `wrangler d1 migrations apply`, and running it without `--config wrangler.preview-migrations.jsonc` would hit the production D1. That D1 has no tracking table, so 0004 would wipe its catalog. The warning is now in `orchestrator.md`. The other findings were doc precision: Preview names, per-Preview secrets, AFRO IN credentials.

## What Went Well

- Reading the Previews docs as raw markdown (`/index.md`) gave exact config shapes; `npm run check`'s dry-run validated the `previews` block with no extra tooling.
- Spiking `wrangler@4.149.0 preview --help` from the npx cache before installing confirmed every command the plan used.
- The staging-only marker product made the isolation proof a single `grep` on two hosts.
- `getPlatformProxy` from `@astrojs/cloudflare` 12.6 kept working on wrangler 4.149, even though 4.149 pulls `miniflare 5.x-alpha`.

## Challenges Encountered

- **Credentials.** The local `wrangler` OAuth login belongs to HOPLA's accounts. The AFRO IN token lives only in the main checkout's gitignored `.env`, so every remote command ran with `--env-file`, without printing it.
- **`--env-file` is an array flag.** Placed before the command, it swallowed the positionals and wrangler printed its help instead of running. It has to come after the command, as `--env-file=<path>`.
- **Preview URLs were behind Cloudflare Access.** A self-hosted Access app ("afro-in - Cloudflare Workers", `*-afro-in.afroinsantamarta.workers.dev`) returned 302 to `cloudflareaccess.com`. The token cannot list Access apps, and the account has no Zero Trust plan, but the app could still be edited. Julio deleted it from the dashboard.
- **Dashboard switch.** Claude Code's safety classifier blocked my click on *Set up Worker Previews* (as a production deploy), so Julio did it himself. The token has no Workers Builds permission (`12006`).

## Bugs Encountered

No bugs encountered during implementation. The one finding with a failure path was the doc-level `d1 migrations apply` hazard, caught by code review (high).

## Divergences from Plan

**Preview proof needed the dashboard first**

- **Planned:** Task 9: deploy the Preview and curl it.
- **Actual:** the Preview deployed, but every request got a 302 from Access until Julio deleted the Access app.
- **Reason:** an existing Access app protected Preview URLs, although Julio had chosen public Previews.
- **Type:** Plan assumption wrong

**Julio's dashboard steps done within the session**

- **Planned:** out of scope (Julio, later).
- **Actual:** Julio asked to finish them here. He removed Access, did the Worker Previews switch (his own click) and loaded the Base secrets in a terminal tab I prepared. Values never reached the agent.
- **Reason:** Julio's request.
- **Type:** Other

**Extra commit after code review**

- **Planned:** 3 commits (A, B, C).
- **Actual:** also b71cc22 (review doc fixes), 9647f25 (switch and secrets recorded), and the d7200c0 merge of `origin/dev`.
- **Reason:** review findings; the plan asked to merge `origin/dev` before the PR.
- **Type:** Other

## Scope Assessment

- **Planned tasks:** 10
- **Executed tasks:** 10
- **Unplanned additions:** 3. Diagnosing and removing the Access app on Preview URLs; guiding the dashboard switch; loading the Base secrets from a terminal tab.
- **Scope accuracy:** Under-scoped. The dashboard side (Access, switch, secrets) took more work than the code.

## Skipped Items

- Bold test webhook → `dev` Preview: Reason: it needs the `dev` Preview, which exists only after the merge, and it is Julio's step in the Bold panel. The orchestrator tracks it in the work list.
- `previews.vars`: Reason: no code reads an environment variable (decided in the plan).
- Migrations 0008–0010 on staging: Reason: not on this branch; they come with D1.

## Technical Patterns Discovered

- **Pattern/Gotcha:** wrangler's global `--env-file` takes multiple values and swallows the positionals that follow it.
  - **Where it applies:** any wrangler command run from a worktree with the AFRO IN credentials.
  - **Ready-to-paste entry** (orchestrator.md, *Project-only rules* → rule 8): `From a worktree, load the AFRO IN credentials with --env-file=<main checkout>/.env placed AFTER the command (npx wrangler d1 list --env-file=…); before it, the flag swallows the command and wrangler prints its help.`
- **Pattern/Gotcha:** `wrangler d1 create` / `r2 bucket create` offer to edit `wrangler.json`.
  - **Where it applies:** creating staging resources.
  - **Ready-to-paste entry:** `Create resources with --update-config=false and edit wrangler.json by hand: the previews block, not the top-level production bindings, must receive staging resources.`
- **Pattern/Gotcha:** Preview URLs can sit behind an Access app even when the Worker's Domains tab says "anyone with this URL can access".
  - **Where it applies:** any Level 5 check on a Preview.
  - **Ready-to-paste entry:** `Before a Level 5 check on a Preview, run curl -sI <preview-url>: a 302 to *.cloudflareaccess.com means an Access app covers *-afro-in.afroinsantamarta.workers.dev (see the Worker's Access tab, "Políticas de nombres de host").`
- **Pattern/Gotcha:** Base secrets reach only Previews created after they are set.
  - **Ready-to-paste entry:** already in `orchestrator.md` (b71cc22).

## Recommendations

- Plan command improvements: for platform/dashboard work, add a Task 0 that probes the target URLs (`curl -sI`) and the token's scopes. Here both the Access app and the missing Builds permission were findable while planning.
- Execute command improvements: when a step is a dashboard click on a production resource, plan it as a user action from the start. The agent's own safety classifier blocks it.
- AGENTS.md / CLAUDE.md additions: the project has neither. The entries above belong in `.agents/orchestrator.md` (the orchestrator owns that file).
