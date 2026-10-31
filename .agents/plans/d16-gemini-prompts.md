# D16 — Gemini prompts for the 2027 artist portraits

Where the portraits appear (all **4:5** frames, `object-fit: cover`, no portrait is a hero): artist card on `/programacion` and `/artistas` (≈380 px wide, 2x = 760 px), the featured Robe L Ninho block (≈460 px, 2x = 920 px) and the scrolling journey photo (≈560 px, 2x ≈ 1120 px). Target for every output: **4:5, 1600 × 2000 px, JPG**.

Per-artist focal points are already in code (`photoPosition` in `src/content/artists2027/*.md`), so nothing is cut at the sides. What code cannot fix: a head that touches the top edge of the original, low resolution, and a landscape photo.

## Review of today's render (4:5 crop, desktop and mobile identical)

| Artist (file in `che/Retratos/`) | Original | Problem | Needs Gemini |
|---|---|---|---|
| Robe L Ninho `robe-l-ninho-retrato.jpg` | 800×1200 | Hair touches the top edge; low resolution for the 920 px featured block | Yes |
| Fafoman `Fafoman-retrato.heic` | 1230×2228 | Cap touches the top edge; ~883 px wide after export | Yes |
| Chichi Banana `chichi-banana-retrato.JPG` | 900×1350 | Curls touch the top edge; low resolution | Yes |
| DJ Acid Burrito `Dj-acid-burrito-retrato.JPG` | 1600×1068 (landscape) | 4:5 cuts about half the width, hands and equipment lost | Yes |
| Choco `choco-retrato.JPG` | 1728×3072 | Hands slightly cut at the bottom; good resolution | Optional |
| Fideles Cadito, Eirini Tsiakka, DJ Joe Kiz Vibes | 3024×4032 | Nothing cut, high resolution (subject is small in the frame) | No |

## Save outputs

Save each result next to its original, in `~/Pictures/Afro In/2027/che/Retratos/`, with the suffix `-web` (e.g. `robe-l-ninho-retrato-web.jpg`). Tell Claude and it will convert, copy into `src/assets/img/2027/artistas/` and swap them in.

**Check before using each one:** open the original and the `-web` file side by side and compare face, features, skin tone, hair, body, clothes and expression. If anything changed, discard it and re-run; do not use it.

## Common rules (already in every prompt)

Extend the background (outpaint) to fit the frame instead of cropping; upscale and sharpen; do not alter the person's face, features, skin tone, hair, body, clothes or expression; no added text or logos; keep the original lighting.

## Prompts (attach the input file, then paste)

### 1. Robe L Ninho — input `che/Retratos/robe-l-ninho-retrato.jpg`
> Take this portrait and produce a 4:5 image at 1600×2000 px. Extend the background (outpaint) above and around the person so the top of the hair has comfortable headroom, instead of cropping. Upscale and sharpen to the final size. Do not alter the person's face, features, skin tone, hair, body, clothes, jewelry or expression. No added text or logos. Keep the original lighting and the dark green-grey background style.

### 2. Fafoman — input `che/Retratos/Fafoman-retrato.heic`
> Take this portrait and produce a 4:5 image at 1600×2000 px. Extend the sky and background (outpaint) above the person so the top of the cap and the leopard-print scarf are fully inside the frame with headroom, instead of cropping. Upscale and sharpen. Do not alter the person's face, features, skin tone, beard, glasses, nose ring, cap, scarf, body, clothes or expression. No added text or logos. Keep the original lighting.

### 3. Chichi Banana — input `che/Retratos/chichi-banana-retrato.JPG`
> Take this portrait and produce a 4:5 image at 1600×2000 px. Extend the plain grey studio background (outpaint) above and to the sides so the curls and headphones have headroom, instead of cropping. Upscale and sharpen. Do not alter the person's face, features, skin tone, hair, headphones, body, clothes or expression. No added text or logos. Keep the original lighting.

### 4. DJ Acid Burrito — input `che/Retratos/Dj-acid-burrito-retrato.JPG`
> Take this landscape photo and produce a vertical 4:5 image at 1600×2000 px. Extend the dark background and the neon light trails (outpaint) above and below to fit the portrait frame, instead of cropping the person; keep the DJ with the colorful headscarf, headphones and hands on the mixer fully in frame. Upscale and sharpen. Do not alter the person's face, features, skin tone, hair, headscarf, body, clothes or expression. No added text or logos. Keep the original lighting and the colored light effects.

### 5. Choco (optional) — input `che/Retratos/choco-retrato.JPG`
> Take this portrait and produce a 4:5 image at 1600×2000 px. Extend the background (outpaint) at the bottom so both hands are fully visible, instead of cropping. Upscale and sharpen. Do not alter the person's face, features, skin tone, hair, sunglasses, body, red shirt or expression. No added text or logos. Keep the original lighting and the dark teal background.
