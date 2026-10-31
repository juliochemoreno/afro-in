# Plan: D16 — Actualizar programación 2027 con comentarios del equipo

## Overview
Contenido + UI pequeña sobre las páginas D9: nuevas actividades por día/venue (Santa Marta y Palenque), bloque "Preventa" con dos botones a eventos de la tienda existente, fotos nuevas. Todo en es/en/fr.

## Requirements Summary
- Contenido en `src/content/tour2027/{santa-marta,palenque}{,.en,.fr}.md` (6 archivos) y, si hace falta, `src/content/artists2027/`.
- Bloque Preventa **adicional** (los tiers 20k/35k/45k actuales se mantienen, decisión de Julio): 150 boletas, $45.000 COP (botón) + Inscripción Afro Batalla $30.000 COP (botón). Varios precios por preventa = D13, fuera de este plan. Los links viven en UN solo valor de configuración (`src/lib/programacion.ts` o frontmatter `presale`); sin URL el botón no se muestra / queda deshabilitado con "Muy pronto".
- Palenque: título «Palenque de Benkos» más grande en el hero de su página y en su tarjeta de `/programacion`; nuevas actividades por día (17–20 ene).
- Hero de `/programacion`: «Festival de Cultura Afro Independiente del Caribe» (es/en/fr) como título/subtítulo (clave `edition.tagline`).
- Fotos: El Morro (reemplaza Masaya DJs), plaza/estatua de Benkos (reemplaza foto Palenque), foto nueva Oh la la! La Puerta. candidatas elegidas en `~/Pictures/Afro In/2027/che` (ver Task 5), pendientes de confirmación de Julio.

## Out of Scope
- Código de ticketing/pagos; precios escalonados (D13); crear los eventos en el admin (Julio).
- Expected UX iterations: 2

## Git Strategy
- Base `dev`; rama `claude/d16-programacion-update-d01d9b`; un PR a `dev`.

## Context References
- `src/content.config.ts` (schema `tour2027`: `days[].activities[]` con `time/title/kind/artist/signupUrl/note`; `tickets.tiers` = solo informativo)
- `src/components/EditionTickets.astro` (renderiza tiers actuales: 20.000/35.000/45.000), usado por `Edition2027StopTemplate.astro:151` y `Edition2027IndexTemplate.astro`
- `src/lib/programacion.ts` (`formatCop`, fechas), `src/i18n` (textos es/en/fr)
- Notas D9: `.../side-session-notes/.../d9-content-2027.md`

## Domain Assumptions (respuestas de Julio ya incorporadas)
- «Concurso parte la patilla» el domingo 17. «Fafomarquez» = Fafoman; «Afroneto» es una persona (solo texto, sin ficha).
- Hora del evento del artista especial el 15 (Oh la la! La Puerta): ninguna fuente la da (afiches: «Enero 15 al 17»; texto del equipo: solo «Clase grupal y shows en vivo»). Se muestra **sin hora** y queda abierto. Sí hay horas: Fafoman 9:00 pm (texto) y DJ Acid Burrito 8 PM el 15 y 16 (afiche).
- Orden de venues: 15 Oh la la! La Puerta, 16 Co·KoA, 17 Masaya. DJ Joe Kiz Vibes: 16 (Co·KoA) y 17 (Masaya), según su afiche.
- «Artista especial» del 15 = Robe L Ninho (afiches: Enero 15 al 17); se confirma al revisar.

## Implementation Tasks

### Task 1: Contenido Santa Marta (es/en/fr)
- **Action:** modify
- **File:** `src/content/tour2027/santa-marta.md`, `.en.md`, `.fr.md`
- **Pattern:** estructura existente de `days[].activities`
- **Details:**
  - 15 ene Oh la la! La Puerta: Dj y clase de baile (Fafoman) 9:00 pm · Show de baile · Show sorpresa · Dj Acid Burrito (8:00 pm, afiche) · Robe L Ninho: clase grupal y shows en vivo (sin hora).
  - 16 ene Co·KoA: 4:00 pm clases de baile (Fideles Cadito y Eirini Tsiakka) · Dj Joe Kiz Vibes · Conversatorio y presentación de Robe L Ninho «Descolonización mental» · Dj Chichi Banana vs Dj Acid Burrito.
  - 17 ene Masaya: 4:00 pm clases de baile semba y salsa (Fideles Cadito y Eirini Tsiakka) · Dj Joe Kiz Vibes · Filtro Afro Batallas de Coupé Décalé (Fafoman) · Dj Chichi Banana · Shows Choco / Robe L Ninho · Final Afro Batallas.
  - Mantener `tickets.tiers`; añadir `presale` (Task 3). Nombres propios sin traducir.
- **Gotcha:** `artist:` solo para fichas existentes; Dj Joe/Dj Acid Burrito: ficha nueva en `artists2027` (con foto de `Retratos/`) o solo texto → decidir al ejecutar (por defecto ficha, el schema ya lo permite).
- **Validate:** `npm run check`

### Task 2: Contenido Palenque (es/en/fr)
- **Action:** modify
- **File:** `src/content/tour2027/palenque{,.en,.fr}.md`
- **Pattern:** idem
- **Details:** 17 ene Afro fiesta en el arroyo desde 9:00 am + Concurso «Parte la patilla»; 18 ene 4 pm clases de baile + Afro In Tour Palenque de Benkos (recorrido con artistas y asistentes); 19 ene clases + 4 pm Podcast «Afro introspección» (Robe L Ninho, Afroneto, Fafoman); 20 ene Afro In Mojadera (fiesta en Palenque de Benkos) + Cierre AFRO IN Palenque 2027: shows de baile y show sorpresa.
- **Gotcha:** «Afroneto» solo texto. Traducir fiel: «patilla» (sandía) se deja en es y se glosa en en/fr.
- **Validate:** `npm run check`

### Task 3: Bloque Preventa con botones
- **Action:** modify
- **File:** `src/components/EditionTickets.astro` (+ prop), `src/content.config.ts`, `src/lib/programacion.ts` (único `PRESALE_LINKS = { presale: "", afroBatalla: "" }`), `src/i18n/locales/{es,en,fr}.json`
- **Pattern:** estilos `fz-*` existentes
- **Details:** Bajo los tiers, dos filas: «Preventa · 150 boletas — $45.000» y «Inscripción Afro Batalla — $30.000», cada una con botón («Comprar boleta» / «Inscribirme»). Enlace vacío → botón deshabilitado «Muy pronto». Añadirlos = editar un valor. No se toca `/eventos`, checkout ni pagos. Aparece en Santa Marta (stop page y listing donde ya salen los tiers).
- **Gotcha:** `lucide-astro/<Icon>` por import individual; textos en 3 idiomas; los links apuntan a afroin.org (`/eventos/<slug>`), pendientes de Julio.
- **Validate:** `npm run check`; curl 3 idiomas.

### Task 4: Palenque de Benkos más grande + título del festival
- **Action:** modify
- **File:** `src/templates/Edition2027StopTemplate.astro`, `src/templates/Edition2027IndexTemplate.astro`, `src/content.config.ts` (campo opcional `titleSize: "large"`), `palenque*.md`, `src/i18n/locales/{es,en,fr}.json` (`edition.tagline`)
- **Details (tamaños propuestos, `[provisional]`):**
  - Hero de la página Palenque (h1 `.stop-name`): hoy `clamp(56px, 8vw, 120px)` → `clamp(72px, 11vw, 168px)` con `titleSize: large`; Santa Marta no cambia.
  - Tarjeta en `/programacion` (`.edition-stop-name`): hoy 48px (40px móvil) → 72px (52px móvil).
  - `edition.tagline`: es «Festival de Cultura Afro Independiente del Caribe»; en «Independent Afro Culture Festival of the Caribbean»; fr «Festival de culture afro indépendante des Caraïbes» (hero de `/programacion`).
- **Gotcha:** que «Palenque de Benkos» no desborde a 375 px (partir en dos líneas).
- **Validate:** Preview desktop + móvil.

### Task 5: Fotos (rutas confirmadas por Julio, base `~/Pictures/Afro In/2027/che/`)
- **Action:** modify
- **File:** frontmatter `heroImage/cardImage/days[].photo` de santa-marta y palenque; copias optimizadas en `src/assets/img/2027/`
- **Details:**
  - El Morro → `Locations/Santa Marta/santa-marta-el-morro-aerea.webp` (aérea de la bahía; 1280×800, baja resolución, puede verse pixelada como hero). Reemplaza la foto "DJs Masaya" (`2014-afroin-img-4.jpg`, hero y día 15).
  - Palenque (hero/tarjeta) → `Locations/Palenque /palenque-estatua-benkos-fafp.JPEG` (¡la carpeta termina en espacio: entrecomillar!). Alternativas en la misma carpeta: `multitud-palenque.jpg`, `palenque-bandera-multitud.jpg` (días 18–19).
  - Oh la la! La Puerta → `Lugares/La puerta/oh-la-la-la-puerta-fachada.jpg` (también `la-puerta-01.JPG` y `fafoman-en-la-puerta.JPG`, útil para el día 15 con Fafoman).
  - Venues (sin uso obligatorio): `Lugares/Co-Koa/{cokoa-fachada,patio-atardecer}.jpg`, `Lugares/Masaya/{masaya-fachada,masaya-piscina,masaya-terraza}.jpg`.
  - Retratos confirmados (`Retratos/`) → reemplazan los recortes de afiche en `src/assets/img/2027/artistas/`: `robe-l-ninho-retrato.jpg`→`robe-l-ninho.jpg`, `choco-retrato.JPG`→`choco.jpg`, `chichi-banana-retrato.JPG`→`chichi-banana.jpg`, `fideles-cadito-retrato.JPG`→`fideles-cadito.jpg`, `Fafoman-retrato.heic`→`fafoman.jpg`, `Eirini Tsiakka-retrato.heic`→`eirini-tsiakka.jpg` (HEIC: convertir con `sips -s format jpeg`). `Dj-acid-burrito-retrato.JPG` y `Dj Joe Kiz Vide.heic` → fichas nuevas "Dj Acid Burrito" y "Dj Joe" (hoy solo texto; el afiche dice «Dj Joe Kiz Vibes», el archivo «Kiz Vide»: ¿cuál es el nombre artístico? → Q8).
  - 4 `WhatsApp Image 2026-10-28 …jpeg` (en `2027/`): 12.09.42 = fachada La Puerta con cartel (de noche); 12.10.29 = hombre en bar «Nojoda»; 12.11.23 = DJ con luces verdes en el mismo bar; 13.38.15 = afiche actualizado de DJ Joe Kiz Vibes (Guinea Bissau, **16 y 17 ene**, Co·KoA y Masaya). Posibles fotos del interior de La Puerta; no se usan salvo que Julio lo pida.
  - Afiche INTROSPECCIÓN: trío Robe L Ninho + Fafoman + tercero sin nombre (¿Afroneto?) → Q2.
- **Revisión de calidad (no se editan aquí; prompts listos para Gemini, Julio decide):** el hero se sirve hasta 1296 px de ancho (≥1920 recomendado), la tarjeta 16:9/4:3, y las fichas de artista son 4:5 (hoy 640×800).
  1. `santa-marta-el-morro-aerea.webp` (1280×800, baja resolución): «Aumenta la resolución de esta foto aérea de la bahía de Santa Marta a 2560×1440 (16:9), conserva exactamente la composición, el islote El Morro y la marina, mejora nitidez y luz cálida del atardecer sin añadir ni quitar elementos.»
  2. `palenque-estatua-benkos-fafp.JPEG` (1500×1000, cielo quemado): «Equilibra la exposición de esta foto: recupera detalle del cielo, mantén a la persona y la estatua de Benkos al fondo, súbela a 2400×1350 (16:9) con recorte centrado en estatua y persona, sin cambiar rostros ni camiseta.»
  3. `oh-la-la-la-puerta-fachada.jpg` (2000×1333, nocturna): «Reduce el ruido y aclara ligeramente las sombras de esta fachada nocturna, conserva los colores neón y el cartel SOY AFRO IN, entrega 2000×1500 (4:3).» (opcional)
  4. `Retratos/*` para ficha 4:5, reencuadrar sin alterar el rostro: `choco-retrato.JPG` (9:16), `Fafoman-retrato.heic` (1230×2228), `fideles-cadito-retrato.JPG`, `Eirini Tsiakka-retrato.heic`, `Dj Joe Kiz Vide.heic` (3:4): «Recorta/reencuadra a 4:5 (1600×2000) centrando cabeza y torso, conserva rostro y ropa idénticos, sin cambiar el fondo.» `robe-l-ninho-retrato.jpg` (800×1200) y `chichi-banana-retrato.JPG` (900×1350): igual y además «aumenta la resolución a 1600×2000». `Dj-acid-burrito-retrato.JPG` (horizontal 1600×1068): «Reencuadra a 4:5 manteniendo a la DJ con el pañuelo y la luz de movimiento; extiende el fondo oscuro lo necesario (outpainting) hasta 1600×2000.»
- **Gotcha:** el schema usa `image()` → archivos dentro de `src/`; renombrar sin espacios al copiar. Hasta tener las versiones editadas se usan las originales (los hero con baja resolución pueden verse suaves).
- **Validate:** `npm run check`; Preview desktop + móvil.

## Test Tasks
- Revisar `npm test` (hay tests de `programacion.ts`); añadir test si se agrega helper de links (presale vacío → sin enlace).

## Validation Checklist
- [x] `npm run check` — exit 0 on the final commit `75fde8b` (and on the merge `c479db4`).
- [x] Code review (`/hopla:code-review`) — `.agents/code-reviews/d16-programacion-2027-update-final.md`, 3 findings fixed.
- [x] `npm test` — 32/32 on `75fde8b`.
- [x] curl 200 of the 2027 stop pages in es/en/fr — against `astro dev` during execution and again on the Preview (`https://claude-d16-programacion-update-d01d9b.afroin.org`, all 200).
- [x] Level 5: Julio checked the Preview before the merge ("todo ok"); merged to dev as `c479db4`.

## Acceptance Criteria
- [x] All activities from the team's comments appear in es/en/fr — `src/content/tour2027/{santa-marta,palenque}{,.en,.fr}.md`; Preview 200 and Julio's review.
- [x] Presale and Afro Batalla ($30.000) buttons read one config (`SALES` in `src/lib/programacion.ts`, empty URL = "Muy pronto"); the presale price/tiers show on the stop pages. Waived detail: the links are still empty — waiting on Julio, a one-line change each.
- [x] No ticketing/payment changes — the review confirmed no checkout, ticketing or payment code in the diff.

## Confidence Score: 7/10
- **Uncertainties:** wording/fechas ambiguos, fotos y URLs pendientes.
- **Mitigations:** preguntas a Julio antes de ejecutar; valores únicos de config.

## Preguntas abiertas
- Hora del evento del artista especial el 15 (Oh la la! La Puerta): ninguna fuente la da; ¿la tiene el equipo? Mientras tanto, sin hora.
- Enlaces/slugs de los dos eventos (Preventa y Afro Batalla): pendientes; los botones salen «Muy pronto».
- Dj Joe/Dj Acid Burrito: ¿ficha nueva en `/artistas` (con foto) o solo texto en la programación? (Por defecto: ficha.)
- ¿Se editan las fotos con Gemini (prompts en Task 5) antes de publicar, o se usan las originales?

## Scope delivered (closed — D16 frozen)

The item grew from a content update into a redesign of the 2027 pages, driven by Julio's decisions during execution. Everything below is in PR #11; anything new goes to D17/D12.

### Layout rule (all 2027 pages)
- **One container = the site header's** (`--fz-content-max` 1136px + `--fz-gutter` 32px, 16px on phones): every heading, paragraph and caption lines up with the logo; `--fz-bleed` (via `100cqw`) is the distance to the screen edge for photos that bleed.
- **Image-led sections edge to edge**: hero, "Dos territorios" (two halves with a 10px gap), next/previous stop card. **Half-screen photos**: journey (bleeds right) and every artist block (bleeds left/right alternating), sticky, with CSS-mask fades on the inner side and top/bottom only. Inside the container: tickets, guest grid, partners, agenda lists.
- **One vertical rhythm** (`--fz-section-pad` 48px desktop / 32px mobile) and one heading → subtitle → content spacing (8px / 32px). Heights capped (480px–85svh).
- Text on big photos scales with them (clamp); photos fade with masks, no per-side overlays, one caption scrim.

### Pages
- **`/programacion` (es/en/fr):** photo hero (full viewport height on desktop) with the festival tagline and the countries strip (flags); intro; Robe L Ninho featured block (sticky photo, dates, tickets); "Dos territorios" (`EditionStops`); journey day by day with sticky photo (venue photos, then the day's artists), day bar and calendar; 9 guest cards in a 3×3 grid (2 columns on small screens, odd last card wide); partners.
- **Stop pages (Santa Marta, Palenque):** hero, day agenda with sticky journey photo, venues, activities with sign-up buttons, tickets/presale (one config value `SALES`), next/previous stop card edge to edge.
- **`/artistas`:** hero like the other pages; one block per artist, same as Robe's (alternating sides, shows all their dates); stacking panels on desktop (sticky, next artist slides over the previous), pinned photo with the text sliding over it on phones; reduced motion honoured. The "Artistas 2026" band is gone (`/artistas/2026` still reachable).
- **Home (`/`, `/en`, `/fr`):** the "AFRO IN Tour 2026" section is replaced, in the home's own style, by the 2027 stops (`Events.astro`): pill "Enero 2027", two cards with badge, number, dates, venues, four highlights and a link to each stop, "Ver programación" and "Comprar preventa" buttons.

### Data and code
- Afroneto joins the artists (Colombia); activities accept `moreArtists`; the Chichi Banana vs Dj Acid Burrito set and the 19 Jan podcast now count for each artist; `countryCode`/`country` are optional in the schema (no flag when unknown); `activityByline` handles artists without a country.
- Components: `EditionHeadliner` (star/reverse/center/portrait options), `EditionStops`, `StopLinkCard`, `Flag`, `Pin`, `DayCalendar`, `EditionVenue`, `EditionPartners`, `FestivalScrolly` (journey with sticky photo), `EditionCountries`; `festival.css` holds the shared rules. Tests: 32 (`tests/programacion.test.ts`).
- No ticketing, checkout or payment code touched.

### Still waiting on Julio (content)
- DJ Joe Kiz Vibes final photo (the current portrait is provisional).
- Arroyo party date: 17 or 18 Jan (the content says 17).
- Time of the Fri 15 Jan event at Oh la la! La Puerta (none in any source); Dj Acid Burrito's time to confirm.
- The presale / Afro Batalla event links: `SALES.tickets.url` and `SALES.afroBatalla.url` in `src/lib/programacion.ts` (`/eventos/<slug>`); until set, the buttons say "Muy pronto".
