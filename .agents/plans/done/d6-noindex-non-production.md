# Plan: D6 — `noindex` on every non-production host

## Overview
Cloudflare adds `X-Robots-Tag: noindex` only to `workers.dev` Previews, not to custom-domain Previews (`<name>.afroin.org`, e.g. `dev.afroin.org`, public with fake data). Add the header ourselves for every host that is not production: static assets through `public/_headers`, Worker-generated (SSR) responses through `src/middleware.ts`. Production (`afroin.org`) responses must not change.

## Requirements Summary
- Any host other than `afroin.org` / `www.afroin.org` answers with `X-Robots-Tag: noindex`, static and SSR.
- `afroin.org` responses are byte-for-byte unchanged in headers.
- Current middleware logic (admin guard, www→non-www, HTTPS, language redirect) stays as is.
- Touch ONLY `public/_headers` (new) and `src/middleware.ts` (D1 works in parallel on the rest).
- Workflow classification: neither is a reactive workflow (a header on every response).

## Out of Scope
- Cloudflare Access, `robots.txt` changes, canonical tags, dashboard changes.
- Ticking D6 in the work list and moving this plan to `done/`: the orchestrator does it (brief limits the PR to two files).
- No UI is touched, so no UX iteration budget.

## Likely Follow-ups
- Disallow-all `robots.txt` on non-production hosts (would need a Worker-served robots; `noindex` header is enough for Google).
- Deployment URLs (`<deployment-id>-<name>.afroin.org`) are covered by the same one-label rule.

## Git Strategy
- **Base branch:** `dev` (current worktree branch `claude/d6-noindex-92e206` is cut from it).
- **Feature branch:** `claude/d6-noindex-92e206` (one branch, one PR to `dev`; the orchestrator merges).

## Context References
- `src/middleware.ts:8-82` — one `onRequest` with early returns (admin redirect, www redirect, HTTPS redirect, language redirect) and `return next()`. Verified by reading the whole file.
- `public/.assetsignore` — contains `_worker.js`, `_routes.json`, `_headers`, `_redirects`. It does NOT block `_headers`: wrangler ignores `_headers` for *upload* by default and reads it separately for rules (`node_modules/wrangler/wrangler-dist/cli.js:33927-33933` default ignore list; `:153303` `maybeGetFile(path.join(directory, "_headers"))` sent as form data, upload not required).
- `@astrojs/cloudflare` 12.6.0 has no `_headers` handling (`grep -rn "_headers" node_modules/@astrojs/cloudflare/dist/*.js` → no hits); Astro copies `public/` verbatim.
- Spike 1 (build): with `public/_headers` present, `npx astro build` produced `dist/_headers` (58 bytes, identical content) next to `dist/.assetsignore`. `dist` is gitignored.
- Spike 2 (rule matching): assets-only `wrangler dev` with the exact rules below, `curl -sI -H "Host: …"` → `afroin.org`: no header; `www.afroin.org`: no header; `dev.afroin.org`: `x-robots-tag: noindex`; `dev-afro-in.afroinsantamarta.workers.dev` and `afro-in.afroinsantamarta.workers.dev`: noindex; `a.b.afroin.org`: no header (`:sub` matches one label only). Log: `Parsed 3 valid header rules`.
- Baseline (live, 2026-10-27, `curl -sI`): `afroin.org/`, `afroin.org/tienda`, `dev.afroin.org/`, `dev.afroin.org/tienda`, `afro-in.afroinsantamarta.workers.dev/` → no `x-robots-tag`; `dev-afro-in.afroinsantamarta.workers.dev/` → `x-robots-tag: noindex` (Cloudflare's own). `www.afroin.org/` → 301 to `https://afroin.org/` (no Worker-side evidence of who serves it).
- Docs: developers.cloudflare.com/workers/previews/custom-domains/ ("Protect Preview content"); workers/static-assets/headers/ (placeholders match one host label; `! Header` detaches; `_headers` does not apply to Worker-generated responses).
- No `Response.redirect`/proxied `fetch` responses in `src/pages` (grep, 0 hits), so `response.headers.set` on the `next()` result is safe (no immutable headers).
- Dependents of the middleware rule: `grep -rn "middleware" src --include=*.ts --include=*.astro` is checked in Task 2; no tests or fixtures exist in the repo.

## Implementation Tasks

### Task 1: Add `_headers` rules for non-production hosts
- **Action:** create
- **File:** `public/_headers`
- **Pattern:** Cloudflare docs example "Prevent your workers.dev URLs showing in search results"
- **Details:** content (tab/two-space indent):
  ```
  # Non-production hosts must not be indexed. Cloudflare only adds noindex to
  # workers.dev Previews. Production (afroin.org) matches none of these rules.
  # Worker-generated (SSR) responses get the header in src/middleware.ts.
  https://:sub.afroin.org/*
    X-Robots-Tag: noindex

  # :sub also matches www; keep it identical to production.
  https://www.afroin.org/*
    ! X-Robots-Tag

  https://:name.:subdomain.workers.dev/*
    X-Robots-Tag: noindex
  ```
- **Gotcha:** the `workers.dev` rule also covers the production Worker's own `afro-in.afroinsantamarta.workers.dev` (currently indexable duplicate of production; not `afroin.org`). Cloudflare already sets the same header on workers.dev Previews: duplicates are harmless. The detach rule must come after the `:sub` rule. Do not remove `_headers` from `public/.assetsignore` (it is the correct "do not upload as asset" entry).
- **Validate:** `npx astro build && cat dist/_headers`

### Task 2: Add the header in the middleware without touching its logic
- **Action:** modify
- **File:** `src/middleware.ts`
- **Pattern:** Astro `sequence()` from `astro:middleware`
- **Details:** import `sequence`; rename the existing `export const onRequest = defineMiddleware(...)` to `const handleRequest = defineMiddleware(...)` (body untouched); add above it a `PRODUCTION_HOSTS = new Set(["afroin.org", "www.afroin.org"])` and `noindexOutsideProduction = defineMiddleware(async (context, next) => { const response = await next(); if (!PRODUCTION_HOSTS.has(new URL(context.request.url).hostname)) response.headers.set("X-Robots-Tag", "noindex"); return response; })`; end with `export const onRequest = sequence(noindexOutsideProduction, handleRequest);`. Because it runs outermost, redirects returned by the inner handler (admin, www, HTTPS, language) also carry the header on non-production hosts. Whitelist production (fail closed): unknown hosts, `localhost` and `*.workers.dev` are noindex.
- **Gotcha:** keep a short comment explaining why (custom-domain Previews). Do not add the header on production hosts, not even with another value.
- **Validate:** `npx tsc --noEmit` (scoped), then the curl matrix in Level 4.

## Test Tasks
No test framework exists (deferred in the work list). Verification is the curl matrix (Level 4) and Level 5 on the Preview. Regression: confirm `/admin` redirect to `/admin/login?next=…`, `/` language redirect with `Accept-Language: en` and `preferred-lang=fr` cookie still return the same status and `Location` as before (compare with `git stash`-free approach: run the same curls on `dev` checkout baseline or read results against expected values).

## Validation Checklist
- [x] **Level 1 — Lint & Format:** none configured. (Discarded: the project has no linter.)
- [x] **Level 2 — Type Check:** `npm run check` (astro build + tsc + `wrangler deploy --dry-run`). Evidence: exit 0; `tsc --noEmit` exit 0 in the review; orchestrator re-ran it on the merge.
- [x] **Level 2.5 — Code Review:** `code-review` skill on the diff; save the artifact in `.agents/code-reviews/`. Evidence: `.agents/code-reviews/d6-noindex-non-production.md`, no real bugs.
- [x] **Level 3 — Unit Tests:** none exist. (Discarded: no test framework; tests deferred in the work list.)
- [x] **Level 4 — Integration (astro dev, NOT wrangler dev):** Evidence: `astro dev --port 4399 --allowed-hosts`; `localhost.afroin.org` `/tienda` and `/` 200 + header, `/admin` 302 + header; `dev.afroin.org`, `foo.afroin.org`, `localhost:4399` header present; `afroin.org`, `www.afroin.org` 301 without header; `afroin.org/admin` 302 without header. Deviation: Astro dev ignores `X-Forwarded-Proto` and Vite blocks unknown Hosts (403) without `--allowed-hosts`; see the execution report.
- [x] **Level 5 — Preview of the branch:** Evidence: `claude-d6-noindex-92e206.afroin.org/` and `/tienda` 200 + `x-robots-tag: noindex`, `/admin` 302 + header; `afroin.org/` and `/tienda` 200 without it. Repeated by the orchestrator with the same result.

## Acceptance Criteria
- [x] `dist/_headers` exists after build with the three rules. Evidence: `cat dist/_headers` after `npm run check`.
- [x] Non-production hosts: static and SSR responses carry `X-Robots-Tag: noindex`. Evidence: Level 4 and Level 5 above.
- [x] `afroin.org` and `www.afroin.org` responses have no `X-Robots-Tag`; status codes and `Location` of every middleware redirect unchanged. Evidence: Level 4 (301 and `/admin` 302 identical, no header) and live `curl` on `https://afroin.org/` and `/tienda`.
- [x] Diff touches only `public/_headers` and `src/middleware.ts`. Evidence: `git diff --cached --stat` before commit a11d707 (2 files, +30 −2).
- [x] `npm run check` passes. Evidence: exit 0.

## Confidence Score: 8/10
- **Strengths:** header rules proven with a local assets worker (including detach and one-label match); build copies `_headers`; middleware change is additive via `sequence`.
- **Uncertainties:** Level 4 depends on Astro dev honoring a spoofed Host; whether Cloudflare applies `_headers` host rules to Preview custom domains exactly like to workers.dev (only Level 5 proves it).
- **Mitigations:** Level 5 on the branch Preview; if the static header is missing there, report instead of guessing.

## Notes for Executing Agent
- Commit on the branch (Conventional Commits, English, `Co-Authored-By` line), push, open PR to `dev`. Do not touch the work list, `.assetsignore` or any other file. This plan file is not part of the PR.
- Questions about product go to Julio; none are expected.
