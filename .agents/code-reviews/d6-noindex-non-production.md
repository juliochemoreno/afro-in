# Code review — D6 noindex on non-production hosts

Reviewer: fresh-context subagent (opus), read-only, 2026-10-27. Scope: `git diff` (`src/middleware.ts`) + `public/_headers`. `npx tsc --noEmit`: exit 0.

**Result: no real bugs found.**

## Verified
- Immutable headers: no route under `src/pages` returns a `fetch()` result or `Response.redirect`; Astro redirects and pages are plain `new Response(...)` (`astro/dist/core/render-context.js:192,230,492-498`).
- Cookies: Astro attaches them after the middleware chain to the returned object (`render-context.js:216-219`); the wrapper returns the same object.
- `sequence`: `next()` without args passes the same context, so `handleRequest` behaves as the old `onRequest`; its early redirects now pass through the noindex wrapper.
- Host matching: `URL.hostname` is lowercased and without port; `localhost`/IPv6 get noindex.
- `_headers`: `! X-Robots-Tag` (with space) is the valid detach form; rules apply in file order, so the www detach after the `:sub` rule works; the apex never matches `:sub.afroin.org`; matching uses `https://<host><path>`.
- `public/.assetsignore` listing `_headers` does not stop the rules: wrangler leaves `_headers` out of the asset upload and sends it separately (4.21.2 `cli.js:33927-33933,153303`; 4.149.0 checked in the npx cache: `:167160-167168,167427,182690`).
- Production: apex and www responses unchanged (status, `Location`, headers).

## Low-severity notes (no action)
1. Hosts with 2+ labels under `afroin.org` (e.g. `x.dev.afroin.org`) would not get noindex on static pages (`:sub` is one label). Today's names are one label.
2. Trailing-dot hosts: `afroin.org.` SSR gets noindex; `dev.afroin.org.` static does not match. Harmless.
3. Some 403/404/500 responses never reach user middleware, so no noindex on non-production hosts; search engines do not index them.
4. Local `node_modules` has wrangler 4.21.2, lockfile pins 4.149.0 (behaviour checked on both).

## Not verified here
Whether Cloudflare applies host-based `_headers` rules on custom-domain Preview hostnames: only Level 5 on the branch Preview shows it.
