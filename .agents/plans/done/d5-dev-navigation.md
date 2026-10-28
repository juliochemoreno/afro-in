# Plan: D5 — slow page-to-page navigation in local dev

Retroactive plan (the work ran measure-first without a separate plan step). Measurements in `.agents/code-reviews/d5-dev-navigation.md`.

- [x] Measure baseline: dev startup, first visit and revisit of `/`, `/tienda`, `/eventos`, `/blog`, a product page
- [x] Change 1: per-icon `lucide-astro` imports in 12 files (kept: 2.25s → 0.03s per page)
- [x] Change 2: `platformProxy` off (measured, rejected: no gain, product page 302 without DB)
- [x] Change 3: `server.warmup` (measured, rejected: no gain)
- [x] Validate: `npm run check`, rendered HTML identical to `dev`
- [x] PR to `dev` (#5, merged 5468ab3)
