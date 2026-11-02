# Code review — D19 ticket confirmation email

- Scope: `git diff bf6bc27..a7e2ecd` (3 commits), fresh-context review (strongest model), 2026-11-01.
- Result: 0 critical, 0 high, 3 medium, 4 low. Fixes in the follow-up commit; `npm run check` and `npm test` (89/89) green after them.

| # | Finding | Outcome |
|---|---|---|
| M1 | A failed admin resend of an already-sent order set `failed` and reopened automatic retries (possible duplicate after 24 h) | Fixed: a failure keeps `sent` when `email_sent_at` is set; automatic retry requires `email_sent_at IS NULL` |
| M2 | The permanent link's origin came from whichever request triggered the send (workers.dev / preview host could reach a buyer) | Fixed: production links always use `https://afroin.org`; request origin only outside production (`EMAIL_SUBJECT_PREFIX` set) |
| M3 | Migration marked paid-but-not-yet-issued orders `skipped` | Fixed: backfill only `status='completed' AND tickets_issued=1` |
| L1 | Same idempotency key across automatic retries with a possibly different body (409 risk) | Mostly removed by M2 (stable origin); left as is |
| L2 | Stale `sending` reclaim had no attempt cap | Fixed: reclaim only while `email_attempts <= 3` |
| L3 | Resend's error text went to logs (could echo data) | Fixed: logs carry order id + HTTP status only; the text stays in `email_error` (admin only) |
| L4 | `ctx.waitUntil` outside the never-throws wrapper | Fixed: `ctx?.waitUntil` in the 4 routes |

## Checked and fine (reviewer)
Atomic claim under webhook/confirm races; email cannot go out with zero tickets; stale-claim recovery + idempotency dedup; payment paths isolated (`waitUntil`, never throws, no-key path writes nothing); D1 numbered binds and `datetime` string comparisons; additive migration; HTML escaping of every interpolated value, token `encodeURIComponent`; no buyer data or token in logs or subject; admin endpoint `requireAdmin`, 404/409, returns no buyer data; localized links; Colombia wall-clock date; Workers runtime (pure-JS QR, `AbortSignal.timeout`).
