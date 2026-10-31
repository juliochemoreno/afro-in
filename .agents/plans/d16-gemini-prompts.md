# D16 — Gemini master prompt for the 2027 artist portraits

> **Status:** master prompt confirmed by Julio (one common background for every portrait). Gemini's image mode has no 4:5 and no pixel size (it gives ~1 MP PNGs in 3:4 or 16:9), so Claude only **crops** to the site's frames (no upscaling) and exports JPG quality 82. First done: Robe L Ninho.

## Two files per artist

| File | Aspect | Size | Gemini selector | Used in |
|---|---|---|---|---|
| `<artist-id>-web-v.jpg` | 4:5 (vertical) | **~896 × 1120** (Gemini 896×1200, trimmed top and bottom evenly) | **3:4** | Every 4:5 frame, on desktop **and** phone: artist cards, the featured Robe block, and the journey photo on desktop |
| `<artist-id>-web-h.jpg` | 16:10 (horizontal) | **~1229 × 768** (Gemini 1376×768, sides trimmed) | **16:9** | The journey photo on phones/tablets (viewport ≤ 900 px) |

The `-h` file is only needed for artists whose photo appears in the journey: today **Robe L Ninho** (Jan 16) and **Fideles Cadito** (Jan 17, first artist of the day). Every other artist needs only `-v`.

`<artist-id>`: `robe-l-ninho`, `choco`, `chichi-banana`, `fafoman`, `fideles-cadito`, `eirini-tsiakka`, `dj-joe-kiz-vibes`, `dj-acid-burrito`.

Julio saves each Gemini result (PNG) in `~/Pictures/Afro In/2027/che/Retratos/Gemini/` as `<artist-id>-web-v.png` (3:4) and `<artist-id>-web-h.png` (16:9), at whatever size Gemini gives. Claude crops with `magick` (face centered, no upscaling) (face stays centered), copies them to `src/assets/img/2027/artistas/` with the same names, checks desktop and 375 px, and commits. The site picks the files up by name and keeps the current photo for any artist without files. Nothing is swapped until then.

## Where each frame renders (measured in the dev server)

| Place | ≤ 560 px (375 px phone) | 768 px | 1280 px | Aspect |
|---|---|---|---|---|
| Artist card, `/programacion` | 164 × 204 (2 columns) | 206 × 257 | 355 × 443 | 4:5 |
| Artist card, `/artistas` | 343 × 429 (1 column) | 2 columns | 355 × 443 | 4:5 |
| Featured Robe block (both pages) | 295 × 369 | 460 × 575 | 460 × 575 | 4:5 |
| Journey photo (sticky frame, `/programacion` and each stop page) | **333 × 208** | **663 × 389** | 422 × 528 | **16:10 up to 900 px**, then 4:5 |

So only the journey photo turns horizontal on phones (an earlier note said "identical on desktop and mobile": that was wrong for this frame); the cards and the Robe block stay 4:5 on every width. The ~1229 px `-h` file covers a 2x phone frame (333 px → 666) and the ~896 px `-v` file covers the largest 4:5 frame (460 px at 2x = 920 px) almost exactly.

## Which photos need regenerating

| Artist (original in `che/Retratos/`) | Original | Problem today |
|---|---|---|
| Robe L Ninho `robe-l-ninho-retrato.jpg` | 800×1200 | Hair touches the top edge; low resolution for the 460 px block |
| Fafoman `Fafoman-retrato.heic` | 1230×2228 | Cap touches the top edge |
| Chichi Banana `chichi-banana-retrato.JPG` | 900×1350 | Curls touch the top edge; low resolution |
| DJ Acid Burrito `Dj-acid-burrito-retrato.JPG` | 1600×1068 (landscape) | A 4:5 crop loses about half the width, hands and equipment |
| Choco `choco-retrato.JPG` | 1728×3072 | Hands slightly cut at the bottom (minor) |
| Fideles Cadito, Eirini Tsiakka, DJ Joe Kiz Vibes | 3024×4032 | Nothing cut; subject is small in the frame (optional, only for a shared style) |

The horizontal image is cropped by `object-fit: cover` with a per-artist focal point (`photoPosition` in `src/content/artists2027/*.md`), so the person must stay near the centre.

## Master prompt

One request = one image. Attach the artist's original photo, choose **3:4** in Gemini's image mode, paste this, and save the result as `<artist-id>-web-v.png`.

```
ROLE: Professional portrait retoucher preparing artist photos for a music and dance festival website. The attached photo is the ONLY source of truth for the person.

IDENTITY — ABSOLUTE RULES:
- Keep the person 100% identical to the original: face shape, eyes, nose, lips, teeth, ears, skin tone and texture, freckles, scars, tattoos, facial hair, hairstyle and hair color, body shape, hands, clothes, accessories (glasses, jewelry, headphones, caps, scarves) and expression.
- Do not beautify, slim, smooth skin, whiten teeth, change age or "improve" any feature. Do not redraw the face: only upscale and sharpen what exists.
- Do not add, remove or move people, objects, text, logos or watermarks.

FRAMING:
- Medium close-up from the top of the head to mid-chest, person centered horizontally.
- Eyes on the upper third line. Clear headroom above the hair or cap; nothing of the head, hair, cap or headphones touches the edge.
- Leave generous empty background on the left and right of the person (the image will be trimmed slightly at the sides).
- If the original is cut (top of head, hands, shoulders), EXTEND the image (outpaint) to complete it naturally. Never crop into the person.

STYLE:
- Background: soft, out-of-focus studio backdrop in a deep warm gradient (charcoal at the edges to dark earth brown behind the head), very subtle film grain. No patterns, scenery or props.
- Light: soft key light from the front-left and a gentle rim light separating hair and shoulders from the background. Keep the person's original skin tone exactly.
- Color: natural, warm, slightly contrasted editorial look. No filters, no black and white, no heavy saturation.
- Quality: maximum resolution, sharp eyes, clean detail, no AI artifacts, no plastic skin, no extra fingers.
```

**Horizontal follow-up** (only Robe L Ninho and Fideles Cadito): in the same chat, switch the selector to **16:9** and send the text below; save the result as `<artist-id>-web-h.png`.

```
Same person, same style, horizontal version: extend the background to the sides, person centered, leave headroom above and some space below, never crop the head.
```

## Per-artist steps

For each artist: attach the original → selector 3:4 → master prompt → compare faces (below) → save `-web-v.png`. For Robe L Ninho and Fideles Cadito also do the 16:9 follow-up and save `-web-h.png`.

| Artist | Attach this original (`che/Retratos/`) | Save as (in `Retratos/Gemini/`) | Also `-h` |
|---|---|---|---|
| Robe L Ninho | `robe-l-ninho-retrato.jpg` | `robe-l-ninho-web-v.png` | yes → `robe-l-ninho-web-h.png` |
| Fideles Cadito | `fideles-cadito-retrato.JPG` | `fideles-cadito-web-v.png` | yes → `fideles-cadito-web-h.png` |
| Fafoman | `Fafoman-retrato.heic` (convert to JPG if Gemini refuses HEIC) | `fafoman-web-v.png` | no |
| Chichi Banana | `chichi-banana-retrato.JPG` | `chichi-banana-web-v.png` | no |
| DJ Acid Burrito | `Dj-acid-burrito-retrato.JPG` (landscape original: Gemini must outpaint to vertical) | `dj-acid-burrito-web-v.png` | no |
| Choco | `choco-retrato.JPG` | `choco-web-v.png` | no |
| Eirini Tsiakka | `Eirini Tsiakka-retrato.heic` | `eirini-tsiakka-web-v.png` | no |
| DJ Joe Kiz Vibes | `Dj Joe Kiz Vide.heic` | `dj-joe-kiz-vibes-web-v.png` | no |

Priority (tight or low-resolution originals): Robe L Ninho, Fafoman, Chichi Banana, DJ Acid Burrito, then Choco; the other three are optional but give every portrait the same background.

## Check before using each result

Open the original and the generated file side by side and compare face, features, skin tone, hair, body, clothes and expression. If anything changed, discard it and run it again.
