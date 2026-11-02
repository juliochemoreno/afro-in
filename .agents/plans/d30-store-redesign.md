# Plan: D30 — Store redesign in the 2027 style

## Overview
Restyle the store (list, product page, cart drawer, checkout, order confirmation) in the 2027 festival style, reusing the product card D17 built for the home so home and store read as one system (shared component, no duplicated CSS). No payment, shipping, Bold, API or schema change.

## Requirements Summary
Decisions by Julio (2026-11-02):
- **List = option A "Catálogo directo"** (chosen on the throwaway preview `src/pages/d27-preview.astro`, not committed): short head (red kicker, Anton title, subtitle), square filter chips (active = red), 4-column grid (2 on phones) of the **same card as the home**: dark `#222` card, product photo on its own white panel, red badge, Anton name, gold price once + `~$N USD` muted, red square button.
- **Head copy = current keys**: `store.hero.badge` "Apoya con Estilo", `store.hero.title` "Tienda AFRO IN", `store.hero.description`. No new copy.
- **Rest of the store approved as proposed**:
  - Product page: 2 columns; photo on a white panel with square thumbnails; right: red category, Anton name, gold price once, description, size/colour as square chips (selected = red), red "Agregar al carrito", shipping notes as a list with small red squares; related products use the shared card.
  - Cart drawer: dark, square, same red button.
  - Checkout: dark, input icons, placeholders that do not repeat the label, summary in a `#222` card (as the tickets form, `TicketCheckoutForm.tsx`/`.tix-form`).
  - Order confirmation (`/pedido`): dark, same style.
  - Card keeps a direct "Agregar" for products without sizes; "Ver opciones" when it has sizes; the home card (no quick add) stays as is.
- Header/Footer `variant="festival"` (the D21 unified menu) on every store page; `<main class="fz">`; Anton + Outfit; no gold frames; mobile checked at 375 px; es/en/fr.
- Products and categories come from D1 (admin CMS); the plan does not decide the catalogue.

Workflow classification: `sequential user-driven` (add to cart → checkout → pay); logic untouched.

## Out of Scope
- Payment amounts, shipping logic, Bold integration, `/api/*`, DB schema, validation rules of the checkout form, admin.
- Light/dark switch (D22). New products or copy rewrites. `/checkout` field set stays (name, email, phone, country, department, city, address, notes).
- Expected UX iterations: 3 (photo-panel proportions, product page spacing and cart density get tuned after Julio sees it locally; v1 = every store page dark, readable at 375 px).

## Likely Follow-ups
- Light theme for the store (D22).
- Better product photos (lifestyle shots on people) to use the faded-photo treatment on the list header.
- Order emails in the same style (D19 layout).

## Git Strategy
- **Base branch:** `dev`. **Branch:** `claude/d30-store-redesign-5c0884` (this worktree).
- Julio runs Level 5 locally; then merge into `dev` with `--no-ff` and push `dev` (no PR), as D17. Never `main`.

## Context References
- `src/components/FeaturedProducts.astro` — D17's home card (markup + scoped CSS: `.home-product*`); becomes a user of the shared card.
- `src/components/ProductCard.astro` (227 lines, old light/rounded look; only used by `TiendaIndexTemplate.astro:87`, verified: `grep -rn "ProductCard" src`) — restyled in place into the shared card.
- `src/templates/TiendaIndexTemplate.astro` — own nav (`storeNavLinks`), `Layout` + old `Header`; filter + quick-add `<script>` use `.filter-btn`, `.product-card[data-category]`, `.quick-add`, `.hidden`, `data-toast-added` on `.store-filters`: keep those hooks.
- `src/templates/TiendaSlugTemplate.astro` (669 lines) — script hooks to keep: `.thumb`, `.size-options .variant-btn`, `.color-options .variant-btn` (`.selected`), `#size-error`, `#add-to-cart-btn` (`.added`, `data-added-text`), `#product-actions` + its `data-product-*`. Note: thumbnails today only toggle `.active` (do not swap the main image) — out of scope to change.
- `src/pages/{tienda,en/store,fr/boutique}/{index,[slug]}.astro` — thin wrappers over the two templates; no change expected.
- `src/components/CartWidget.astro` (293) + `src/styles/cart.css` (470) — cart drawer, mounted inside `Header.astro:157`; vanilla JS in `src/lib/cart`.
- `src/templates/CheckoutTemplate.astro` (301) + `src/components/CheckoutForm.tsx` (435, classes `checkout-*`, `ck-*`) + `src/styles/checkout-fields.css` + `src/components/checkout/{Combobox,LocationFields,PhoneField}.tsx`.
- `src/templates/PedidoTemplate.astro` (152) + `src/components/OrderReceipt.tsx` (127) — `Header variant="minimal"` today.
- Style model: `src/styles/festival.css` (`.fz`, `.fz-wrap`, `.fz-display`, `.hm-*` incl. `.hm-card`, `.hm-input-icon`; `:root:has(main.fz.home)` dropdown styles), `src/templates/EventoSlugTemplate.astro` (`.tix-form`, `.ck-field`) + `src/components/TicketCheckoutForm.tsx` (lucide `Mail`, `User` icons), `src/styles/tickets-theme.css`.
- D17: commit `25a0bce`, `.agents/plans/d17-home-redesign.md`, `.agents/code-reviews/d17-home-redesign.md`.
- Photos: `src/assets/img/store/` (16 files, all on white backgrounds → they sit on a white panel; full-bleed fades do not suit product shots).
- Seed catalogue in `migrations/0004_seed_products.sql` is older than production (8 products); the real list is whatever the admin has.
- Preview/dev: `.claude/launch.json` (untracked, excluded) runs `astro dev` on 4327 with the main checkout's `.env` sourced (never printed). The preview page `src/pages/d27-preview.astro` is excluded via `.git/info/exclude`; delete at the end.

## Domain Assumptions
- The product page's `store.product.shipping.*` notes keep their current wording — confirm.
- The filter chips list stays the categories found in the products (`getLocalizedProduct(...).category`), "Todos" first — confirm.
- The checkout asks nothing new; icons go only on fields where one fits (name, email, phone, address, notes) — confirm.
- `/pedido` switches from `Header variant="minimal"` to `festival` (it is a store page now, with the menu) — confirm.

## Implementation Tasks

### Task 1: Shared product card
- **Action:** modify
- **File:** `src/components/ProductCard.astro`, `src/components/FeaturedProducts.astro`
- **Pattern:** `FeaturedProducts.astro` (`.home-product*` markup and CSS)
- **Details:** Move D17's card look into `ProductCard.astro` (`hm-card`, white photo panel, red badge, Anton name linking to the product, gold price + muted USD once, red square button). Keep `data-category`, `.hidden`, `.quick-add` + `data-*` attributes and the three button branches (sizes → "Ver opciones", `showQuickAdd` → "Agregar", else "Ver detalles"). Make `FeaturedProducts.astro` render `<ProductCard product={product} lang={lang} showQuickAdd={false} />` and delete its duplicated card CSS (keep only `.products-grid`, or move the grid into a shared class). Mobile: 2 columns, 8px padding, 18px name.
- **Gotcha:** the home is a server island; `ProductCard` must not rely on `Astro.url` (pass `lang`, already supported). Product images on the home come from R2 `/media`; empty image → `ImagePlaceholder`. Do not change the home's look (compare before/after).
- **Validate:** `npx tsc --noEmit`; home store section and `/tienda` show identical cards at 1280 and 375 px.

### Task 2: Store list page
- **Action:** modify
- **File:** `src/templates/TiendaIndexTemplate.astro`
- **Pattern:** `src/templates/AlliesTemplate.astro` shell; D17 `Store.astro` head (`hm-head`, `hm-kicker`, `hm-title`, `hm-sub`)
- **Details:** `FestivalFont` + `festival.css`, `Header variant="festival"` (drop the local `storeNavLinks`/`storeCta`), `<main class="fz">`, `Footer variant="festival"`. Head from the existing keys; square filter chips (`.filter-btn`, active = red) with the same script; grid of `ProductCard`; the "¿Quieres vender…?" note restyled like `Store.astro`'s `.store-note` (no emoji, no card). Same `<Layout title>`.
- **Gotcha:** keep `data-toast-added` on `.store-filters` and the script as is; `getProducts(db)` unchanged.
- **Validate:** filters hide/show cards; "Agregar" adds + opens the cart; es/en/fr.

### Task 3: Product page
- **Action:** modify
- **File:** `src/templates/TiendaSlugTemplate.astro`
- **Pattern:** Task 2 shell; `.tix-form`/`EventoSlugTemplate.astro` for chips and button
- **Details:** festival shell as Task 2. Replace the `<style>` block: white photo panel (square, `object-fit: contain`), square thumbnails (active = red `2px` outline, no gold frame), red category label (drop the SKU badge unless Julio keeps it), Anton name, gold price once with muted USD, description, variant chips square (`.selected` = red fill), red full-width "Agregar al carrito" (disabled state clear), shipping notes as `hm-list`-style list, related products with `ProductCard showQuickAdd={false}`.
- **Gotcha:** do not touch the `<script>` or any id/data attribute; the added-to-cart toast text in the script is hardcoded Spanish (existing behavior, leave).
- **Validate:** product with sizes: error without size, add with size; product without sizes; out of stock disabled; 375 px.

### Task 4: Cart drawer
- **Action:** modify
- **File:** `src/styles/cart.css` (and `src/components/CartWidget.astro` styles only if needed)
- **Pattern:** `Header.astro` festival variant
- **Details:** dark drawer `#1b1b1b`, white text, gold totals, square corners, red "Pedir/Pagar" button, visible remove/clear buttons, qty buttons square.
- **Gotcha:** the cart is also in the header on every page (events, home): scope changes so they look right on both the dark festival header and the old pages; do not change `src/lib/cart` or the markup ids used by its JS.
- **Validate:** open the cart on `/tienda`, `/` and `/programacion`; add/remove/qty work; 375 px.

### Task 5: Checkout page
- **Action:** modify
- **File:** `src/templates/CheckoutTemplate.astro`, `src/components/CheckoutForm.tsx`, `src/styles/checkout-fields.css`
- **Pattern:** `src/components/TicketCheckoutForm.tsx` + `.tix-form` in `EventoSlugTemplate.astro`
- **Details:** festival shell; dark `.checkout-card` (`#222`, `#2e2e2e` border), summary card, square inputs; add lucide icons (`User`, `Mail`, `Phone`, `MapPin`, `StickyNote`) inside fields using `.hm-input-icon` (`lucide-react` is already a dependency), placeholders that do not repeat the label (adjust `checkout.*.ph` keys in es/en/fr only where they repeat); red "Pagar" button; dark dropdowns for country/department/city: extend the `:root:has(main.fz.home)` popover rules to `main.fz` (also `.fz.home`) so they apply on the checkout.
- **Gotcha:** no change to state, validation, `ckFields` ids, the POST body or the Bold redirect (`git diff` of `CheckoutForm.tsx` shows markup/className/icon changes only); `tests/checkout-fields.test.ts` must still pass.
- **Validate:** empty-submit shows the inline errors; fill + submit reaches the Bold step in test mode without paying; 375 px.

### Task 6: Order confirmation
- **Action:** modify
- **File:** `src/templates/PedidoTemplate.astro`, `src/components/OrderReceipt.tsx`
- **Pattern:** Task 5
- **Details:** festival shell (Header festival), dark receipt card, gold total, red "Seguir comprando" button; success/pending/failed states each readable on dark.
- **Gotcha:** `client:only="react"`; keep the polling/status logic and `t` keys.
- **Validate:** `/pedido?...` with a test order id in all three statuses if reproducible; otherwise visual check of the three states by temporarily forcing the state locally (not committed).

### Task 7: Cleanup
- **Action:** delete / modify
- **File:** `src/pages/d27-preview.astro` (untracked), `.claude/launch.json`, the exclude lines in `.git/info/exclude`, unused CSS/keys
- **Details:** remove the preview and the two exclude lines; grep any style/key left unused (`store.*`, `checkout.*`) before deleting.
- **Validate:** `npm run check`.

## Interaction Matrix
| Action | Context | Expected behavior |
|---|---|---|
| Click filter chip | List | Shows only that category; "Todos" shows all; active chip red |
| "Agregar" | Card without sizes | Item added, toast, cart opens |
| "Ver opciones" | Card with sizes | Goes to the product page |
| "Agregar al carrito" without size | Product with sizes | Size error shows, nothing added |
| Select size/colour | Product page | One selected at a time per group; selected = red |
| Add to cart | Product page | Toast, cart opens, button says "added" for 2 s |
| Qty ± / remove / clear | Cart | Totals update; empty state shows |
| Submit empty form | Checkout | Inline errors, no request |
| Tab / Shift+Tab | Checkout | Natural order, visible focus ring |
| Empty cart | Checkout | Empty state with button back to the store |

## Test Tasks
Visual work with no new logic: `npm test` must still pass (`tests/checkout-fields.test.ts` covers field helpers). Manual regression after implementation: filters, quick add, size validation, cart quantities, checkout validation, Bold test-mode redirect, `/pedido` states, `/tienda`, `/en/store`, `/fr/boutique`, `/checkout`, `/en/checkout`, `/fr/paiement`, home store section unchanged.

## Validation Checklist
- [ ] **Level 1 — Lint & Format:** no linter configured; covered by the build.
- [ ] **Level 2 — Type Check:** `npx tsc --noEmit`
- [ ] **Level 2.5 — Code Review:** `code-review` skill on the changed files; artifact saved in `.agents/code-reviews/d30-store-redesign.md`.
- [ ] **Level 3 — Unit Tests:** `npm test`
- [ ] **Level 4 — Integration:** `npm run check`; local dev with the main checkout's env; the six store URLs above return 200.
- [ ] **Level 5 — Human Review:** Julio, locally in his browser, before merge to `dev`: store list, one product (with and without sizes), cart, checkout up to the payment screen without paying, `/pedido`, in es/en/fr, desktop and 375 px. If skipped, the redesign ships unseen.

## Acceptance Criteria
- [ ] Store list, product, cart, checkout and order pages are dark, in the 2027 style (Anton titles, square corners, red buttons, white text, gold price once).
- [ ] Home and `/tienda` use one shared card component; no duplicated card CSS.
- [ ] Checkout inputs have icons and placeholders that do not repeat labels.
- [ ] No change to payment amounts, shipping logic, Bold, API or schema; form scripts/validation unchanged in the diff.
- [ ] No horizontal scroll at 375 px; `npx tsc --noEmit`, `npm test`, `npm run check` pass.

## Confidence Score: 8/10
- **Strengths:** direction approved on a preview; card already built in D17; thin page wrappers; no backend work.
- **Uncertainties:** local D1 has no products unless migrations are applied (list may be empty locally); cart CSS is shared with every page header; checkout dropdowns are portaled out of scope.
- **Mitigations:** apply local migrations or check with the dev Preview; scope cart styles and test on three pages; extend the `:has(main.fz)` dropdown rules.

## Notes for Executing Agent
- UI specs are `[provisional]`. **Expected UX iterations: 3**.
- Julio iterates locally: no commit suggestions until he asks; commit/merge only after his Level 5.
- Run every `gh` command as `GH_TOKEN=$(gh auth token -u juliochemoreno) gh …`; never read or print `.env`/`.dev.vars`; Julio releases to production, never you.
