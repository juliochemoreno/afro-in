# Code review — D0 Worker Previews

- Target: branch `claude/d0-worker-previews-a96ae4` vs `origin/dev` (408f02b)
- Effort: medium (hopla) → native `/code-review` ran at high
- Native review: ran · Project checklist: none (`.agents/guides/review-checklist.md` absent); HOPLA checklist applied
- Kept: 4 · Dropped: 1

```
severity: high
confidence: 85
source: native
file: .agents/orchestrator.md
line: 30
issue: The documented `d1 migrations apply` workflow can hit the production D1 if `--config` is forgotten
detail: wrangler.json binds DB to production `afroin`, which has no d1_migrations table. `npx wrangler d1 migrations apply DB --remote` without the preview config would run 0001–0007 there, and 0004 begins with `DELETE FROM product_images; DELETE FROM products;`. The risk already existed; this PR makes the command more prominent.
suggestion: Warn explicitly next to the command.
outcome: fixed — warning added to the Migrations bullet (production config left untouched on purpose)
```

```
severity: medium
confidence: 85
source: native
file: .agents/orchestrator.md
line: 28
issue: Preview URL shape `<branch>-afro-in…` is wrong for branches with `/`
detail: The Preview name is the branch sanitized for a hostname; `feature/x` cannot appear literally in a host.
suggestion: Say `<preview-name>` and point to the URL printed by Builds or `wrangler preview`.
outcome: fixed
```

```
severity: medium
confidence: 90
source: native
file: .agents/orchestrator.md
line: 28
issue: Docs omit that Base secrets reach only Previews created after they are set
detail: Cloudflare docs (Previews › Configuration › Secrets): "Later changes to Base secrets apply only to new Previews". The `d0-worker-previews` Preview already exists.
suggestion: Document `wrangler preview secret put <KEY> --name <preview>` for existing Previews.
outcome: fixed
```

```
severity: low
confidence: 80
source: native
file: .agents/orchestrator.md
line: 28
issue: The manual Preview command needs the AFRO IN credentials
detail: The local wrangler OAuth login belongs to HOPLA's accounts; the AFRO IN token lives in the main checkout's gitignored `.env`, which is auto-loaded only from there.
suggestion: Mention `--env-file=<main checkout>/.env` from worktrees.
outcome: fixed
```

## Dropped (low confidence)

- package-lock.json — wrangler 4.149.0 pins `miniflare 5.20261006.1-alpha` (local `astro dev` runtime only; `/`, `/en/`, `/tienda`, `/tienda/gorra-negra`, `/api/contador` → 200 verified) (confidence 40)

## Checklist pass

- Secrets: none committed (`account_id` and D1 ids are identifiers, already public for production); `.dev.vars.example` has empty placeholders only.
- SQL: `seeds/preview.sql` is a static staging-only insert, outside `migrations/`.
- Plan deviations: none in code. Task 9's proof is pending because the Preview URLs turned out to be behind Cloudflare Access (Julio is removing it).
