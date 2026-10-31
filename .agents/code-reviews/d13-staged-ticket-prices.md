# Code review — D13 staged ticket prices

- **Branch:** `claude/d13-staged-tickets-0aa889`, reviewed at `6a9d9dd` (phases 1–3) against `origin/dev`.
- **Reviewer:** fresh-context subagent (strongest model), read-only. The review covered both the code and the design of the money path.
- **Plan:** `.agents/plans/d13-staged-ticket-prices.md`

## Result

- 0 high-severity findings, 2 medium, 6 low.
- No findings on security, the SQL parameter numbering, or backward compatibility for events without stages.
- Every finding was fixed in the review-fix commit, except one part of #2 that needs Julio (a rate-limit rule in the Cloudflare dashboard).

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | An order that Bold approved but whose tickets are not issued yet is neither held nor sold, so its seats could be sold again in that window. | Fixed. `IS_HOLDING` now also counts `status='completed' AND tickets_issued=0`, with no time limit. It is used in the event hold, the stage hold and the guarded insert. Verified with curl: a 2-hour-old completed-but-unissued order still reduces "Quedan N". |
| 2 | medium | Anyone could lock a stage with unpaid 30-minute holds, including a buyer who retries after closing the Bold window. | Partly fixed. One buyer email cannot hold more than 10 seats per event in unpaid orders: 409 `pending_payment`, verified with curl. Still open: a per-IP rate limit on `/api/tickets/checkout`, which is a Cloudflare dashboard rule and so Julio's to set. |
| 3 | low | `issueTicketsForOrder` logged oversell only at event level. | Fixed: it also logs `Ticket stage oversell` when the stage quota is exceeded. |
| 4 | low | A stage that sold out and has passed its end date did not open the next stage early. | Fixed in `stageStatuses`, with a test added. |
| 5 | low | The server read a `null` or `""` stage price or quota as 0, which made the stage free. | Fixed: a non-numeric value is refused. Test added. |
| 6 | low | A stage delete racing with a new order was skipped without telling the admin. | Fixed: PUT returns 409 naming the stage when its delete changed nothing. |
| 7 | low | The new checkout errors were Spanish only, and "Entrada Libre" was hardcoded. | Fixed: `CheckoutError` carries a stable `code` (and `n`). The form maps the code to `tix.form.err.*` keys in es/en/fr, and the free label is the new key `tix.price.free`. |
| 8 | low | A staged event that has fully ended showed the first stage's price. | Fixed: it shows the last stage's price. |

## Money-path design review (summary of the reviewer's answers)

- **Charged price:** always `unit * qty`, computed on the server from the stage `resolveSale` picks. Bold signs the server amount. `expectedUnitPrice` from the client is only compared, and a mismatch gets 409 `price_changed` before anything is written.
- **Concurrent checkouts:** the single-statement guarded `INSERT … SELECT … WHERE issued + held + qty <= capacity` (event and stage), checked through `meta.changes`, prevents a double sale. Proved locally: 3 parallel checkouts for 1 seat → exactly one 201. The completed-but-unissued gap is closed by #1.
- **Payment approved after the hold expired:** tickets are still issued, by design. The oversell is logged at event and stage level.
- **Free stage:** takes the existing free path (order and tickets in one batch), never holds, and counts as sold at once.
- **Admin edits stages while orders are pending:** orders keep their snapshotted `unit_price` and `amount`. Deleting a stage that has orders is refused (pre-check, SQL guard, and the race check from #6).
- **`issueTicketsForOrder` and Bold confirm:** unchanged and compatible with the nullable `stage_id`.
