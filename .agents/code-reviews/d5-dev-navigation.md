# D5 — local dev navigation (review + measurements)

Method: `astro dev --port 4399`, Vite cache cleared before each run, curl `-w %{time_total}`, same machine, local D1 seeded (migrations 0003-0006, 0008, 0009 with `--local`). Seconds.

| Page | Baseline first | Baseline revisit | Icons first | Icons revisit |
|---|---|---|---|---|
| startup | 4.33 | | 3.0-3.2 | |
| / | 10.26 | 2.25 | 0.30-0.45 | 0.03 |
| /tienda | 2.29 | 2.29 | 0.07 | 0.03 |
| /eventos | 2.27 | 2.24 | 0.04 | 0.01 |
| /blog | 2.37 | 2.25 | 0.14 | 0.01 |
| /tienda/camiseta-afroin-classic | 2.34 | 2.31 | 0.09 | 0.06 |

Other candidates (on top of icons): `platformProxy` off: no real gain (cold `/` 1.46s) and the product page 302s without DB, so unsafe: rejected. `server.warmup` (5 pages): no gain (`/` first 0.82s): rejected.
Finding: the cost was per request, not just compile (revisit = first at baseline), consistent with the barrel being re-processed each SSR request.

Review: change is mechanical (12 files, only import lines). Rendered HTML for `/`, `/tienda`, `/eventos`, `/blog`, a product page is identical to `dev` after stripping dev-only attributes (source line numbers, random server-island ids). `npm run check` passes. Not measured: click-to-swap in a browser with ClientRouter (server response now ~0.03s, which was the delay). No Astro upgrade proposed: numbers do not justify it.
