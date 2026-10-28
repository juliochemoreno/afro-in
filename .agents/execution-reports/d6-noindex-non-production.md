# Execution Report — D6 `noindex` on every non-production host

## Meta Information

- **Plan:** `d6-noindex-non-production` — `.agents/plans/done/d6-noindex-non-production.md`
- **PR:** https://github.com/juliochemoreno/afro-in/pull/3. Merged into `dev` as a027c8b (orchestrator, `--no-ff`).
- **Commits:** a11d707 (feature), 2dc58ab (merge `origin/dev` into the branch), plus the closing commit (plan archive, code review, this report).
- **Files added:** `public/_headers`
- **Files modified:** `src/middleware.ts`
- **Lines changed:** +30 −2 (`public/_headers` +13; `src/middleware.ts` +17 −2)
- **Closing files (docs only):** `.agents/plans/done/d6-noindex-non-production.md`, `.agents/code-reviews/d6-noindex-non-production.md`, this report.

## Validation Results

- Syntax & Linting: Not applicable (no linter in the project)
- Type Checking: ✓ `npm run check` (astro build + tsc + `wrangler deploy --dry-run`) exit 0; `dist/_headers` generated. The orchestrator re-ran it on the merge.
- Unit Tests: Not applicable (no test framework; tests deferred in the work list)
- Integration Tests: ✓
  - `astro dev --allowed-hosts` + `curl -sI -H "Host: …"`: `localhost.afroin.org` `/tienda`, `/` → 200 with `x-robots-tag: noindex`; `/admin` → 302 `/admin/login?next=%2Fadmin` with the header; `dev.afroin.org` and `foo.afroin.org` → 301 (HTTPS redirect) with the header; `afroin.org` and `www.afroin.org` → 301 without it; `afroin.org/admin` → same 302 as before, no header.
  - Level 5 on the branch Preview `claude-d6-noindex-92e206`: `https://claude-d6-noindex-92e206.afroin.org/` (static) and `/tienda` (SSR) → 200 + `x-robots-tag: noindex`; `/admin` → 302 + header; `https://afroin.org/` and `/tienda` → 200, no header. The orchestrator repeated it and got the same result.

## Code Review Findings

- **Code review file:** `.agents/code-reviews/d6-noindex-non-production.md` (fresh-context subagent, read-only)
- **Issues found:** 0 critical, 0 high, 0 medium; 4 low notes (no action)
- **Issues fixed before this report:** 0 (nothing to fix)
- **Key findings:** No real bugs. Confirmed no route returns an immutable `Response`, Astro cookies survive the `sequence` wrapper, and `public/.assetsignore` listing `_headers` does not block the rules. Low notes: hosts with 2+ labels under `afroin.org` are not covered on static pages; trailing-dot hosts behave inconsistently; some 403/404/500 never reach the middleware.

## What Went Well

- Spiking `_headers` with an assets-only `wrangler dev` and `curl -H "Host: …"` proved the rule semantics (one-label `:sub`, `!` detach order, apex untouched) before writing the file, and a throwaway `astro build` proved `dist/_headers` is produced.
- Reading wrangler's source settled the `.assetsignore` question (it only affects upload; `_headers` is read separately) without a deploy.
- `sequence(noindexOutsideProduction, handleRequest)` kept the existing handler's body untouched (diff is additive plus one rename) and also covers its early redirects.
- The Preview was reachable ~2.5 minutes after the push, so Level 5 needed no manual deploy.

## Challenges Encountered

- `astro dev` answers 403 to any Host outside localhost (Vite `allowedHosts`), so spoofed Hosts needed `--allowed-hosts` on the CLI (no config change).
- `astro dev` ignores `X-Forwarded-Proto`, so every spoofed-host request hit the existing HTTPS redirect. Host `localhost.afroin.org` avoids it (the middleware skips hostnames that include `localhost`) and is not a production host.
- The language redirect cannot be exercised on `/` in dev: prerendered pages get no request headers, so both the original and the new middleware answer 200.

## Bugs Encountered

No bugs encountered during implementation.

## Divergences from Plan

**Level 4 curl matrix**

- **Planned:** `curl -H "Host: <h>" -H "X-Forwarded-Proto: https" http://localhost:4321/tienda`, and a header-present check with `Host: localhost:4321`.
- **Actual:** port 4399 with `--host 127.0.0.1 --allowed-hosts`; `localhost.afroin.org` as the non-production 200 host; the HTTPS 301 of `dev.afroin.org`/`foo.afroin.org` as the redirect evidence.
- **Reason:** Vite blocks unknown Hosts; Astro dev ignores `X-Forwarded-Proto`.
- **Type:** Plan assumption wrong (the plan allowed this fallback in its Level 4 note).

**Plan file and code review in the repo**

- **Planned:** plan and review stay out of the PR (brief: touch only two files).
- **Actual:** both are committed with the closing commit, as the orchestrator asked.
- **Reason:** HOPLA close-out (archive + review artifact in the repo).
- **Type:** Other.

## Scope Assessment

- **Planned tasks:** 2
- **Executed tasks:** 2
- **Unplanned additions:** 0
- **Scope accuracy:** On target

## Skipped Items

- A true 200 SSR check on a production host in `astro dev` — Reason: the HTTPS redirect cannot be avoided for `afroin.org` over plain HTTP; covered by the 301 without header and by the live `curl` on `https://afroin.org/` and `/tienda`.

## Technical Patterns Discovered

- **Pattern/Gotcha:** `astro dev` rejects unknown Host headers (403) unless started with `--allowed-hosts`, ignores `X-Forwarded-Proto`, and gives prerendered pages no request headers. To test host-dependent middleware, use `Host: localhost.<domain>` (skips the HTTPS redirect, is not production).
- **Where it applies:** any middleware that depends on hostname, protocol or request headers, checked with curl against `astro dev`.
- **Ready-to-paste AGENTS.md / CLAUDE.md entry:** "- Host-dependent middleware in `astro dev`: start it with `npx astro dev --allowed-hosts` (otherwise Vite answers 403 to spoofed `Host` headers), use `curl -H 'Host: localhost.afroin.org'` for a non-production 200 (the middleware skips the HTTPS redirect for hostnames containing `localhost`; `X-Forwarded-Proto` is ignored), and expect no request headers on prerendered pages (the language redirect cannot be tested on `/` in dev)."
- **Pattern/Gotcha:** `public/_headers` host rules: `:sub` matches exactly one label (`dev.afroin.org` yes, `a.b.afroin.org` no, apex no); a detach line `! Header` needs the space and must come after the rule it removes; `_headers` listed in `public/.assetsignore` is harmless.
- **Ready-to-paste entry:** "- `public/_headers` applies only to static assets; SSR responses need the same header in `src/middleware.ts`. Host rules use `https://:sub.afroin.org/*` (one label); remove inherited headers with `! Header` after the broader rule."

## Recommendations

- Plan command improvements: when a plan's Level 4 relies on spoofed Hosts or protocols against the framework dev server, spike it during planning (this one cost three rounds of curl).
- Execute command improvements: none.
- AGENTS.md / CLAUDE.md additions: the two entries above (Astro dev host testing; `_headers` host rules).
- Follow-up (not scheduled): if previews ever move to a two-label host (`x.dev.afroin.org`), add `https://:a.:b.afroin.org/*` to `public/_headers`.
