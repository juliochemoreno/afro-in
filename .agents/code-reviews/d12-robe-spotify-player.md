# Code review — D12 Spotify player

- Effort: medium (checklist pass done inline by the executing agent; the native review was not run separately, the change is 4 small files)
- Project review checklist (`.agents/guides/review-checklist.md`): not present; HOPLA checklist categories applied
- Counts: kept 0 / dropped 0

Checked: no `autoplay`; the iframe URL comes only from `spotifyEmbedUrl` (22-char alphanumeric id, so no injection into `src`); client script runs inside `astro:page-load` and disconnects on `astro:before-swap` (rule 10); `data-ready` prevents double initialisation; placeholder and iframe share a fixed 152px height (no layout shift); no `100vw`; no secrets (the artist id is public); D23 files untouched.

Verified in `astro dev` (port 4324): no iframe in the HTML, iframe created only after scrolling near the block, desktop `/programacion` and 390px `/artistas` render the player, no horizontal scroll, es/en/fr labels present.

Code review passed. No technical issues detected.
