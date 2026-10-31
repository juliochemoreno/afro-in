# D16 — Gemini master prompt for the 2027 artist portraits

> **Status:** the master prompt text is pending Julio's confirmation (the orchestrator sends it); paste it in the "Master prompt" section below. The frame specs, file names and swap-in rules here are final.

## Two files per artist

| File | Aspect | Size | Used in |
|---|---|---|---|
| `<artist-id>-web-v.jpg` | 4:5 (vertical) | **1600 × 2000** | Every 4:5 frame, on desktop **and** phone: artist cards, the featured Robe L Ninho block, and the journey photo on desktop |
| `<artist-id>-web-h.jpg` | 16:10 (horizontal) | **1600 × 1000** | The journey photo on phones/tablets (viewport ≤ 900 px) |

`<artist-id>` is the file name of the artist's card: `robe-l-ninho`, `choco`, `chichi-banana`, `fafoman`, `fideles-cadito`, `eirini-tsiakka`, `dj-joe-kiz-vibes`, `dj-acid-burrito`.

Save each result in `~/Pictures/Afro In/2027/che/Retratos/` next to the original, as `<artist-id>-web-v.jpg` / `<artist-id>-web-h.jpg`. Claude then copies them to `src/assets/img/2027/artistas/` with the same names; the site picks them up by name and keeps the current photo for any artist whose files do not exist yet. Nothing is swapped until they are there.

## Where each frame renders (measured in the dev server)

| Place | ≤ 560 px (375 px phone) | 768 px | 1280 px | Aspect |
|---|---|---|---|---|
| Artist card, `/programacion` | 164 × 204 (2 columns) | 206 × 257 | 355 × 443 | 4:5 |
| Artist card, `/artistas` | 343 × 429 (1 column) | 2 columns | 355 × 443 | 4:5 |
| Featured Robe block (both pages) | 295 × 369 | 460 × 575 | 460 × 575 | 4:5 |
| Journey photo (sticky frame, `/programacion` and each stop page) | **333 × 208** | **663 × 389** | 422 × 528 | **16:10 up to 900 px**, then 4:5 |

So only the journey photo turns horizontal on phones (an earlier note said "identical on desktop and mobile": that was wrong for this frame); the cards and the Robe block stay 4:5 on every width. The 1600 × 1000 `-h` file covers the largest horizontal frame (≈ 840 px wide at 2x); the 1600 × 2000 `-v` file covers the largest 4:5 frame (460 px at 2x = 920 px) with margin.

## Which photos need regenerating

| Artist (original in `che/Retratos/`) | Original | Problem today |
|---|---|---|
| Robe L Ninho `robe-l-ninho-retrato.jpg` | 800×1200 | Hair touches the top edge; low resolution for the 460 px block |
| Fafoman `Fafoman-retrato.heic` | 1230×2228 | Cap touches the top edge |
| Chichi Banana `chichi-banana-retrato.JPG` | 900×1350 | Curls touch the top edge; low resolution |
| DJ Acid Burrito `Dj-acid-burrito-retrato.JPG` | 1600×1068 (landscape) | A 4:5 crop loses about half the width, hands and equipment |
| Choco `choco-retrato.JPG` | 1728×3072 | Hands slightly cut at the bottom (minor) |
| Fideles Cadito, Eirini Tsiakka, DJ Joe Kiz Vibes | 3024×4032 | Nothing cut; subject is small in the frame (optional, only for a shared style) |

The `-h` version needs an outpainted wide frame with the person kept inside the centre third, because the phone frame is cropped by `object-fit: cover` with a per-artist focal point (`photoPosition` in `src/content/artists2027/*.md`).

## Master prompt

*(pending — paste the confirmed text here)*

Rules the final text must keep: extend the background (outpaint) to fit the frame instead of cropping; upscale and sharpen; do not alter the person's face, features, skin tone, hair, body, clothes or expression; no added text or logos; keep the original lighting; one shared style for all portraits.

## Check before using each result

Open the original and the generated file side by side and compare face, features, skin tone, hair, body, clothes and expression. If anything changed, discard it and run it again.
