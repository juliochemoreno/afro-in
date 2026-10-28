# Plan: D8 — Checkout forms UX (store, tickets, donation)

## Overview

This plan makes the three Bold checkouts send correctly formatted customer data. Bold gets the phone as national digits with `dialCode`, and the store also sends `billingAddress`. Each form shows per-field errors before the buyer goes to pay. The store gets cascading country → department/state → city pickers: DIVIPOLA for Colombia, `country-region-data` elsewhere. Every form gets a dial-code + number phone field, required in all three. The unstyled country field is fixed by sharing one field stylesheet.

## Requirements Summary

- Design: `.agents/specs/2026-10-27-checkout-forms.md` (approved by Julio, 2026-10-27). It is authoritative; this plan turns it into tasks.
- Bold prefill: `customerData` = `{ fullName, email, phone (national digits), dialCode ("+57") }` in all three. The store also sends `billingAddress` = `{ address, city, state, country (alpha-2) }`.
- Phone: dial-code combobox + digits-only number. Required in store, tickets and donation (client and server), except where noted in Domain Assumptions.
- Store location: searchable combobox cascade. Colombia uses DIVIPOLA (33 departments, 1,122 municipalities). Other countries use `country-region-data` states, with city as free text. A country without states (0–1 regions in the dataset) gets free text for state and city.
- Donation: country as today, plus the new phone field. Tickets: phone only, no location.
- Validation UX: on Pay (or "Next" in donation step 1), every invalid field shows a red border and a message underneath, and the first one is scrolled into view and focused. After the first attempt, fields revalidate as they change. The button stays enabled.
- Workflow classification: **sequential user-driven** (fill → press Pay → one commit handler). No effects that auto-submit. The only reactive pieces are cascade resets (country → clears department/city, department → clears city) and the dial code following the country. These are synchronous state derivations in event handlers, not effects on async data. The geo lookup (ipapi) is the one async source and only sets a default.
- Prices and amounts stay server-side (orchestrator rule 1). The payment confirmation flow (`/api/*/confirm`, `bold-webhook`, return pages, `Layout.astro` return handler) is not touched.

## Out of Scope

- Visual redesign of the pages (D9). D8 only fixes and unifies the form fields, following the current site look.
- New DB columns or migrations: the existing text columns hold the new values (verified, see Context References).
- PayPal flow changes beyond phone being required on the client.
- Shipping fees, address autocompletion (Google Places is capped at 500/day, see the work list).
- Admin screens (they display stored strings as is).
- Expected UX iterations: 3

## Likely Follow-ups

- Show the dial code + phone nicely in admin order and ticket lists.
- Validate the Colombian department/city on the server against DIVIPOLA (today: presence only).
- Reuse `PhoneField` in the admin courtesy-ticket form.
- D9 redesign of checkout pages.

## Git Strategy

- **Base branch:** `dev` (worktree already cut from `origin/dev` at a551af2)
- **Feature branch:** `claude/d8-checkout-forms-237c58` (this worktree's branch; one branch, one PR to `dev`)

## Context References

Read before starting:

- `.agents/specs/2026-10-27-checkout-forms.md` — the approved design.
- `.agents/orchestrator.md` — rules 1 (server prices), 3 (Bold order prefixes), 5 (es/en/fr), 9 (`--env local` only for `astro dev`).
- `src/components/CheckoutForm.tsx` (333 lines) — store island. Today: `form` state with `name,email,phone,department,city,address,notes` (L66–74). Single `error` string (L64). Country read from a hidden DOM input `#checkout-country` (L94–97) and sent as the Spanish **name** (`countries.find(...).name`, L97) in `shipping.country`. Prefill block L148–154: `customerData` = `fullName`, `email`, raw `phone`, with no `dialCode`.
- `src/components/TicketCheckoutForm.tsx` (230 lines) — `form` = `name,email,phone` (L52). Same prefill block L119–125. Free events: `data.free` → redirect (L95–98). Keep that.
- `src/components/CountryCombobox.tsx` (153 lines) — Radix Popover + cmdk combobox. Writes a hidden `<input id={inputId}>`, localizes names with `Intl.DisplayNames`, and does an ipapi geo lookup (L68–83). Used by `Registration.astro` L109 (`client:visible`, default `inputId="country"`) and by `CheckoutForm.tsx`.
- `src/components/Registration.astro` (1,372 lines) — donation. Step 1 fields: `#name`, `#email`, `#phone` (L77–106), `CountryCombobox` (L109). `validateStep1` returns one message, shown as a toast (~L950, L1277–1281). Bold path ~L1145–1233 reads `#phone` and builds `customerData` (L1215–1221). PayPal path reads `#phone` (L980s) and posts to `/api/donante` **after the PayPal payment completes** (`onComplete`). The `.cc-trigger` and `[data-slot=…]` popover styles live here, in `<style is:global>` L820–890. They are the only reason the country field looks right on the donation page.
- `src/templates/CheckoutTemplate.astro` — passes `countries`, `countryStrings` and `t` (built from the `CK_KEYS` list, L20–49) to `CheckoutForm` (`client:only="react"`). Its `<style is:global>` (L89+) holds `.checkout-card`, `.ck-row`, `.ck-field`, `.ck-error`, but no `.cc-*` styles → **root cause of Julio's note (3)**.
- `src/templates/EventoSlugTemplate.astro` — `TicketCheckoutForm client:load` (L128–137) with a `strings` object. `.tix-form .ck-field` styles L145+.
- `src/lib/orders.ts` — `createPendingOrder` validates name/email (L97–101). Shipping is stored with `clean(s.x, 80)` and **no presence check** (L164–185). Phone `clean(input.customer?.phone, 40)`. Local `EMAIL_RE` L12.
- `src/lib/tickets.ts` — `createPendingTicketOrder` (L185+) validates name/email (L192–196) and stores phone `clean(input.buyer?.phone, 40)` (L277). `createCourtesyTicketOrder` (L325+) is admin-only and keeps phone optional.
- `src/pages/api/store/checkout.ts` — checks Bold keys **before** validation (L30–33). Locally that needs `.dev.vars` (see spike below). Returns `{ error }` with `CheckoutError.status`.
- `src/pages/api/bold-firma.ts` — donation Bold signing. Validates name, email and amount (L40–56) and inserts `donors.phone` (L72+). Runs **before** payment, so it is safe to reject there.
- `src/pages/api/donante.ts` — PayPal donor registration. Requires `name,email,amount` (L24). Runs **after** payment (see Domain Assumptions).
- DB columns (verified): `orders.customer_phone TEXT`, `ship_country/ship_department/ship_city/ship_address/ship_notes TEXT` (`migrations/0007_create_orders.sql` L18–27). `ticket_orders.buyer_phone` (`src/lib/tickets.ts` L260, L419). `donors.phone` (`bold-firma.ts` L72). All free text, so no migration.
- i18n: `src/i18n/locales/{es,en,fr}.json` (e.g. `checkout.err.city` at L121 in each). Keys reach islands through the key lists in the templates and through `data-t-*` attributes in `Registration.astro` (L60–66).
- `src/data/countries.ts` — 223 entries `{ code, name (es), emoji }`.

Verified platform and data claims (commands run 2026-10-27):

- `country-region-data@4.1.0` (`npm pack` into scratch). ESM `dist/data.js` exports `allCountries: [countryName, countryShortCode, regionsString][]` (see `dist/data.d.ts`). `data.json` has 249 countries `{ countryName, countryShortCode, regions: [{ name, shortCode }] }`. CO has 33 regions, US 62, FR 26. Countries with ≤1 region: AQ, AW, BV, IO, CX, CW, FK, GF, GI, GP, GU, HM, VA, HK, IM, JE, MO, MQ, NU, NF, PN, RE, MF, SX, TC (treat as "no states"). License MIT. `dist/data.js` is 130 KB raw. `npm view country-region-data time` → latest 4.1.0 (2026-02-06, older than two weeks).
  - **Read the regions shape from `dist/data.d.ts` before coding.** `allCountries` tuples encode regions differently from `data.json`. Alternative: import `country-region-data/data.json` (exported, 339 KB raw). Pick one in Task 7 and note it.
- DIVIPOLA: `curl -s "https://www.datos.gov.co/resource/gdxc-w37w.json?\$select=count(*),count(distinct%20cod_dpto)"` → `[{"count":"1122","count_distinct_cod_dpto":"33"}]`. Row shape: `{"cod_dpto":"05","dpto":"ANTIOQUIA","cod_mpio":"05001","nom_mpio":"MEDELLÍN","tipo_municipio":"Municipio",…}`. `tipo_municipio` ∈ {Municipio, Isla, Área no municipalizada}: keep all. Names are UPPERCASE with accents and need title-casing ("BOGOTÁ, D.C.", "ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA").
- Dial codes: `https://raw.githubusercontent.com/mledoze/countries/master/countries.json` (250 countries, ODbL). The field is `idd: { root, suffixes[] }`. CO `+5`/`[7]` → `+57`. US/DO/PR `+1` with many area-code suffixes → `+1`. VA `+3`/`[906698, 79]` → `+39`. AQ empty → no dial code.
- Node test runner without a dependency: `node -v` → v22.14.0. Spike `node --experimental-strip-types --test a.test.ts` (importing `./a.ts`) → `# pass 1`. The Astro base tsconfig sets `allowImportingTsExtensions: true` (`node_modules/astro/tsconfigs/base.json` L10), so `tsc` accepts the `.ts` import in tests.
- Local Bold keys: the worktree had no `.dev.vars`. `cp <main checkout>/.dev.vars .dev.vars` (gitignored: `git check-ignore -q .dev.vars` → ignored) + restart `astro dev`. Then `curl -X POST localhost:4331/api/store/checkout -d '{}'` → `{"error":"El carrito está vacío"}` (before the copy: `Payment provider not configured`).
- Bold prefill format (developers.bold.co, Botón de pagos → integración manual / personalizada): `customerData` JSON string with `email`, `fullName`, `phone` ("3040777777"), `dialCode` ("+57"), optional `documentNumber`/`documentType`. `billingAddress` JSON string with `address`, `zipCode`, `city`, `state`, `country` (two-letter code). All optional. No documented max lengths and nothing on what happens when a value is malformed → **Task 0 spike**.

Dependents search:

- `grep -rn "CountryCombobox" src` → 3 hits: the component, `CheckoutForm.tsx`, `Registration.astro`. All are covered by tasks.
- `grep -rn "customerData" src` → 3 hits (the three forms). All are covered.
- `grep -rln "cc-trigger\|data-slot=\"popover-content\"" src` → `CountryCombobox.tsx`, `Registration.astro`. The styles move to the shared stylesheet (Task 5).
- `grep -rn "checkout-country" src` → `CheckoutForm.tsx` only. It goes away with Task 8.

## Domain Assumptions

Confirm or correct each one before execution:

- **PayPal donor record keeps phone optional on the server.** `/api/donante` runs after the PayPal payment has been taken. If it rejected a missing phone, a paid donation would lose its donor row. The client still requires phone in step 1 for both methods. *(Deviation from the spec's "required on the server" for donations: `/api/bold-firma` does require it, because it runs before payment.)*
- Phone is stored in the existing columns as `"+57 3001234567"` (dial code, one space, national digits). Old rows keep their old format.
- Phone rule: with `+57` the number must have exactly 10 digits (mobile `3xx…`, landline `60x…`). With any other dial code, 4–14 digits.
- The dial code follows the selected country until the buyer changes it by hand. After that it stays as chosen.
- Store: department/state is required when the chosen country has a states list. On the server, the department is required only for Colombia (no states dataset in the Worker). City and address are required for every country, country is always required, notes stay optional.
- `orders.ship_country` keeps storing the country's Spanish name (as today, for admin). The ISO code goes only to Bold and to server validation.
- DIVIPOLA names are stored and sent in title case with accents ("Medellín", "Bogotá, D.C."). Bold receives them as is.
- Admin courtesy tickets keep phone optional.

## Requirements Delta

See spec: .agents/specs/2026-10-27-checkout-forms.md
Owns: REQ-CHECKOUT-001, REQ-CHECKOUT-002, REQ-CHECKOUT-003, REQ-CHECKOUT-004

## Implementation Tasks

### Task 0: Spike — Bold accepts and shows the new prefill
- **Action:** N/A (spike, no commit)
- **File:** N/A (browser on `http://localhost:4331/checkout` with local Bold TEST keys)
- **Pattern:** the current `CheckoutForm.tsx` submit (L136–163)
- **Details:** With a cart in localStorage (`afroin_cart`), call `/api/store/checkout` from the browser console with a valid payload. Then open `new BoldCheckout({...config, customerData: JSON.stringify({fullName, email, phone:"3001234567", dialCode:"+57"}), billingAddress: JSON.stringify({address:"Calle 1 # 2-3", city:"Santa Marta", state:"Magdalena", country:"CO"})}).open()`. Record whether Bold opens and which fields are prefilled. Repeat with `dialCode:"+1"`, and with a city with accents ("Medellín").
- **Gotcha:** on localhost (http) omit `redirectionUrl`. Do not complete a payment. If Bold refuses to open, it is a format problem, so drop `billingAddress` first and retest.
- **Validate:** screenshot of Bold's form showing the prefilled fields. Record the outcome in the execution report.
- **Time-box:** 30 min. Fallback: if `billingAddress` breaks or is ignored, ship `customerData` only. If prefill can only be confirmed on the Preview, carry the check to Level 5.

### Task 1: Add `country-region-data` and a test script
- **Action:** modify
- **File:** `package.json`, `package-lock.json`
- **Pattern:** exact pins like `"astro": "5.10.1"`
- **Details:** `npm install country-region-data@4.1.0 --save-exact` (approved by Julio 2026-10-27). Add script `"test": "node --experimental-strip-types --test tests/"`.
- **Gotcha:** no other dependency. Node prints an ExperimentalWarning for strip-types; that is fine.
- **Validate:** `npm ls country-region-data` → 4.1.0. `npm test` runs (0 tests is fine at this point).

### Task 2: Generate DIVIPOLA and dial-code data
- **Action:** create
- **File:** `scripts/gen-divipola.mjs` → `src/data/divipola.json`; `scripts/gen-dial-codes.mjs` → `src/data/dialCodes.ts`
- **Pattern:** N/A (one-off generators, committed together with their output)
- **Details:**
  - `gen-divipola.mjs`: fetch `https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=2000`, group by `cod_dpto`, and output `[{ code, name, municipalities: [{ code, name }] }]` sorted by name (`localeCompare('es')`). Title-case in Spanish: lowercase the connectors `de, del, la, las, los, y, e, el` when they are not the first word, and keep `D.C.` as is. Assert 33 departments and 1,122 municipalities, otherwise exit 1. Write minified JSON with a header comment in the script naming the source URL and the date.
  - `gen-dial-codes.mjs`: fetch the mledoze `countries.json` and emit `export const dialCodes: Record<string, string> = {...}` for the codes in `src/data/countries.ts`. Rule: root `+1` → `+1`; one suffix → root+suffix; otherwise print the code and use an `OVERRIDES` map (at least `VA: "+39"`). Skip empty roots. Add a header comment with the source and license (ODbL).
- **Gotcha:** the datos.gov.co JSON uses `$limit` (default 1,000, so a short page would cut it). The ODbL attribution goes in the generated file's header.
- **Validate:** `node scripts/gen-divipola.mjs && node scripts/gen-dial-codes.mjs`, then spot-check: Magdalena contains "Santa Marta"; `dialCodes.CO === "+57"`, `dialCodes.US === "+1"`, `dialCodes.FR === "+33"`; `ls -l src/data/divipola.json` is under 60 KB.

### Task 3: Shared field validators
- **Action:** create
- **File:** `src/lib/checkoutFields.ts`, `tests/checkout-fields.test.ts`
- **Pattern:** `EMAIL_RE` and `clean()` in `src/lib/orders.ts`
- **Details:** Pure functions, no imports with `@/`: `EMAIL_RE`; `isValidEmail`; `normalizeDigits(s)` (strip everything that is not a digit); `isValidPhone(dialCode, national)` (per Domain Assumptions); `formatPhone(dial, national)` → `"+57 3001234567"`; `parsePhone(stored)` → `{ dialCode, national } | null` (accepts `"+57 3001234567"`); `DIAL_RE = /^\+\d{1,4}$/`. Export `FIELD_MAX = { name: 100, email: 120, phone: 20, address: 200, city: 80, department: 80, notes: 500 }`.
- **Gotcha:** the server files keep their own `EMAIL_RE`/`clean` for unchanged paths. Only the new checks import from here. No `@/` alias in this file (node test runner).
- **Validate:** `npm test` passes cases for CO with 10 digits ok, 9 digits fail, `+1` with 10 digits ok, `+44` with 4 digits ok, letters stripped, `parsePhone` round-trip.

### Task 4: Bold prefill builder
- **Action:** create
- **File:** `src/lib/boldPrefill.ts`, `tests/bold-prefill.test.ts`
- **Pattern:** the three existing `customerData` blocks (CheckoutForm L148–154)
- **Details:** `buildCustomerData({ name, email, phone })` → JSON string. `phone` is the stored format and goes through `parsePhone` into `phone` + `dialCode`; both are omitted if parsing fails. `buildBillingAddress({ address, city, state, country })` → JSON string, or `undefined` when `country` is not two letters. Trim every value.
- **Gotcha:** keep the spike's (Task 0) findings: drop `billingAddress` from the store if the spike says so.
- **Validate:** `npm test`: `"+57 300 123 4567"`-like stored values give `phone:"3001234567"` and `dialCode:"+57"`.

**Commit A** (after Tasks 1–4): `feat(checkout): add location data, field validators and Bold prefill builder`, with tests `tests/checkout-fields.test.ts` and `tests/bold-prefill.test.ts`.

### Task 5: Generic combobox + shared field styles
- **Action:** create + modify
- **File:** `src/components/checkout/Combobox.tsx` (new), `src/components/CountryCombobox.tsx` (modify), `src/styles/checkout-fields.css` (new), `src/components/Registration.astro` (move styles out), `src/templates/CheckoutTemplate.astro`, `src/templates/EventoSlugTemplate.astro` (import the stylesheet)
- **Pattern:** `src/components/CountryCombobox.tsx` (Popover + Command, `cmdk` `filter`)
- **Details:**
  - `Combobox` props: `options: { value, label, prefix? }[]`, `value`, `onChange(value)`, `placeholder`, `searchPlaceholder`, `emptyText`, `disabled?`, `invalid?`, `id?`, `triggerRef?`, `ariaDescribedBy?`. The trigger gets `aria-invalid`.
  - `CountryCombobox` keeps its public props and hidden input (donation and existing callers keep working). It adds an optional controlled `value`/`onChange`, and, when the value changes, dispatches `new Event("change", { bubbles: true })` on its hidden input so vanilla JS can react. The geo lookup moves to `useGeoCountry()` in the same file, exported for `PhoneField`.
  - Move `.cc-*`, `[data-slot=…]` and `.cc-flag` rules from `Registration.astro` L820–890 into `checkout-fields.css`. Add the shared error state: `.ck-field.is-invalid input`, `.is-invalid .cc-trigger` (red border), `.ck-field-error` (small red text). Add the same for `.form-group.is-invalid` in the donation form. Import the CSS in the two templates and in `Registration.astro`.
- **Gotcha:** the global reset `* { padding: 0 }` overrides Tailwind's padding inside the popover. Keep the `[data-slot]` rules exactly. The popover is portaled to `body`, so its styles must be global. Use the frontend-design skill for the error state and focus ring, staying within the site's tokens (`--color-primary`, `--radius-md`).
- **Validate:** `/checkout` country field looks like the donation one (screenshot desktop + 375px). The donation country picker still works on `/unirse`.

### Task 6: `PhoneField`
- **Action:** create
- **File:** `src/components/checkout/PhoneField.tsx`
- **Pattern:** `Combobox` from Task 5; `countries` + `dialCodes`
- **Details:** Props: `lang`, `countries`, `value` (stored format) / `onChange(stored)`, `country?` (alpha-2 to follow), `followCountryInputId?` (donation: listen to `change` on `#country`), `useGeoDefault?` (tickets), `invalid?`, `errorId?`, labels, `hiddenInputId?`/`hiddenName?` (donation writes `#phone` hidden). Layout: a compact dial combobox (flag + `+57`, searchable by country name or code) and a `type="tel" inputMode="numeric" autoComplete="tel-national"` input. Internal `dialTouched` flag: country changes update the dial only while `!dialTouched`. Default dial `+57`.
- **Gotcha:** several countries share `+1`. Keep the chosen country code internally, not just the dial string. On mobile the row must not overflow at 320px (dial ~6.5rem, number flexible).
- **Validate:** manual check in Task 8/9/10. `npm run check` type-checks it.

### Task 7: `LocationFields`
- **Action:** create
- **File:** `src/components/checkout/LocationFields.tsx`
- **Pattern:** `Combobox`; dynamic `import()`
- **Details:** Controlled props `value: { country, department, city }`, `onChange`, `errors`, refs for focus. Country uses `Combobox` with localized names (reuse `CountryCombobox` logic or its `localized` memo) and geo default. On country change it clears department and city. For `CO`: `await import("@/data/divipola.json")` → department combobox → city combobox (disabled until a department is chosen; clears on department change). For other countries: `await import("country-region-data")` (or `/data.json`, see Context References) → state combobox when the country has more than one region, otherwise text input; city is a text input. A loading state keeps the previous inputs disabled. Expose `hasStates` to the parent for validation.
- **Gotcha:** cache module promises at module level (no refetch per render). A race when the country changes twice quickly: ignore stale results by comparing against the latest country. Countries in `countries.ts` missing from the dataset fall back to text.
- **Validate:** manual: CO → Magdalena → Santa Marta; US → states list → text city; AW → text state and city. `npm run build` output: the DIVIPOLA and region chunks are separate from the checkout entry chunk (`ls -l dist/_astro` sizes noted in the report).
- **Time-box:** 60 min for the cascade. Fallback: native `<select>` for department (still searchable city).

**Commit B** (after Tasks 5–7): `feat(checkout): shared combobox, phone and location fields`. No tests (UI; covered by manual checks).

### Task 8: Store checkout — fields, per-field validation, Bold prefill
- **Action:** modify
- **File:** `src/components/CheckoutForm.tsx`, `src/templates/CheckoutTemplate.astro`
- **Pattern:** current submit flow (L85–169), unchanged order: validate → POST `/api/store/checkout` → `sessionStorage store_order_id` → `BoldCheckout.open()`
- **Details:** State `form` adds `phone` (stored format), `country` (alpha-2), `department`, `city`. `errors: Partial<Record<Field, string>>` + `attempted`. `validate()` returns errors in DOM order: name, email, phone, country, department (if `hasStates`), city, address. On Pay: if there are errors → set them, scroll the first into view (`block: "center"`) and focus it (input or combobox trigger), and return. After `attempted`, each change revalidates that field. Each field gets `aria-invalid` + `aria-describedby` → `<p class="ck-field-error" id=…>`. The POST body keeps its shape, plus `shipping.countryCode`. `shipping.country` = Spanish name from `countries`. `customer.phone` = stored format. Prefill via `buildCustomerData` + `buildBillingAddress`. The server `{ error }` still shows in `.ck-error` above the button. Template: add new i18n keys to `CK_KEYS`, pass `countries` (already passed).
- **Gotcha:** keep `redirectionUrl` handling and `successPath` exactly. Do not touch `/pedido` or the confirm flow. `client:only="react"` stays.
- **Validate:** local `/checkout`: Pay with an empty form → 7 errors, focus on name; fill → Bold test checkout opens with prefill (desktop + 375px).

### Task 9: Server — store order validation
- **Action:** modify
- **File:** `src/lib/orders.ts`
- **Pattern:** existing `CheckoutError` checks L97–101
- **Details:** After the email check: phone required and valid (`parsePhone` + `isValidPhone`), stored as `formatPhone(...)`. `shipping.country` required. `shipping.countryCode` optional but, if present, must match `/^[A-Z]{2}$/`. `department` required when `countryCode === "CO"`. `city` and `address` required. Lengths via `FIELD_MAX`. Messages in Spanish like the current ones ("El teléfono es obligatorio", "Teléfono inválido", "La ciudad es obligatoria", "La dirección es obligatoria", "El departamento es obligatorio", "El país es obligatorio").
- **Validation:** required `customer.name ≤100`, `customer.email` (EMAIL_RE) `≤120`, `customer.phone` `+D{1,4} digits` (CO = 10 digits), `shipping.country ≤80`, `shipping.city ≤80`, `shipping.address ≤200`, `shipping.department ≤80` (required for CO), `notes ≤500`. The payload cap stays 20 KB.
- **Error UX:** 400 `{ error }`, shown in `.ck-error` above the Pay button (only reachable when the client is bypassed).
- **Gotcha:** validation must stay before any D1 write (today all checks precede the INSERT at L165). Do not change the re-pricing code.
- **Validate:** curl matrix (Level 4).

**Commit C** (after Tasks 8–9 + store i18n keys from Task 12): `feat(checkout): store checkout validation, location pickers and Bold prefill`.

### Task 10: Tickets — phone field, validation, prefill; server
- **Action:** modify
- **File:** `src/components/TicketCheckoutForm.tsx`, `src/templates/EventoSlugTemplate.astro`, `src/lib/tickets.ts`
- **Pattern:** Task 8
- **Details:** Client: `PhoneField` with `useGeoDefault`, per-field errors for name, email and phone, same focus behavior, prefill via `buildCustomerData`. Keep the free-ticket redirect and the qty stepper. Server `createPendingTicketOrder` only: require a valid phone (stored via `formatPhone`), placed after the email check (L195). `createCourtesyTicketOrder` unchanged.
- **Validation:** `buyer.phone` required, same format as store.
- **Error UX:** 400 `{ error }` → `.ck-error` under the total.
- **Gotcha:** `PhoneField` needs `countries` and `dialCodes`. Pass `countries` from the template (import `@/data/countries`). Add the new keys to the template's `strings`.
- **Validate:** local `/eventos/<slug>`: empty submit → errors; valid → Bold opens (or the free redirect).

### Task 11: Donation step 1 — phone island, per-field errors, Bold prefill; server
- **Action:** modify
- **File:** `src/components/Registration.astro`, `src/pages/api/bold-firma.ts`
- **Pattern:** existing `CountryCombobox` island + hidden input pattern; `validateStep1`
- **Details:** Replace the `#phone` input with `<PhoneField client:visible hiddenInputId="phone" hiddenName="phone" followCountryInputId="country" …/>`. `#phone` stays a hidden input holding the stored format, so the PayPal and Bold code that reads `#phone` keeps working. `validateStep1` → `validateStep1All()` returns `{ field, message }[]`. It toggles `.is-invalid` on each `.form-group` and fills/removes a `<p class="field-error">`, then focuses the first invalid control (for islands: `.cc-trigger` or the tel input inside the group). After the first attempt, `input`/`change` listeners on `#name`, `#email`, hidden `#phone`, hidden `#country` revalidate. The toast for step-1 errors is removed. Bold: `customerData` via `buildCustomerData`. Server `bold-firma.ts`: require a valid phone (400 `{ error: "A valid phone is required" }`) and store `formatPhone`. **`/api/donante` is NOT changed** (Domain Assumptions).
- **Validation:** `bold-firma`: `phone` required, same format rule.
- **Error UX:** client per-field. A server 400 → the existing generic error toast.
- **Gotcha:** the `<script>` runs on `astro:page-load` (ClientRouter): attach listeners inside that handler, as today. `PhoneField` must dispatch `change` on its hidden input. The donation geo lookup already sets `#country`, and the phone follows it. Do not change amounts, fee gross-up, PayPal `env`/`business`, or `redirectionUrl`.
- **Validate:** local `/unirse` (es) + `/en/…` (check the route in `src/i18n/routes.ts`): Next with empty fields → 3–4 inline errors; valid → step 2; Bold opens with prefill; the PayPal button renders.

### Task 12: i18n strings (es/en/fr)
- **Action:** modify
- **File:** `src/i18n/locales/es.json`, `en.json`, `fr.json`
- **Pattern:** existing `checkout.err.*`, `tix.form.err.*`, `join.error.*` keys
- **Details:** Add errors (`checkout.err.phone`, `checkout.err.country`, `checkout.err.department`, `tix.form.err.phone`, `join.error.phone`), labels and placeholders (`checkout.state` "Departamento / Estado", `checkout.department.select`, `checkout.city.select`, `checkout.city.pickDepartmentFirst`, `checkout.list.search`, `checkout.list.empty`, `phone.dial.search`, `phone.dial.label`). Each lands in the commit of the form that uses it (C or D).
- **Gotcha:** rule 5: all three languages in the same commit. `useTranslations` is typed by `ui.ts`, so check whether new keys must be declared there (`grep -n "checkout.err.city" src/i18n/ui.ts`).
- **Validate:** `npm run check` (types). Visual check on one en and one fr page.

**Commit D** (after Tasks 10–12): `feat(checkout): phone field and inline validation for tickets and donations`.

### Task 13: Work list
- **Action:** modify
- **File:** `.agents/plans/2026-10-27-work-list.md`
- **Pattern:** D1/D6 entries
- **Details:** At the start: add D8 to *In flight* (branch, PR when opened). Tick D8 is the orchestrator's job when it merges. Record the dependency added and the Domain-Assumption deviation (`/api/donante`).
- **Gotcha:** the orchestrator also edits this file. Keep the edit small to avoid merge conflicts.
- **Validate:** `git diff` shows only the D8 lines.

## Interaction Matrix

| Action | Context | Expected Behavior |
|---|---|---|
| Click Pay / Next | Some fields invalid | Errors shown on every invalid field, first scrolled to center and focused, no request sent |
| Click Pay | All valid | Button shows "processing", POST, Bold opens |
| Type in a field | Before first attempt | No error shown |
| Type / select | After first attempt | That field's error appears/disappears live |
| Select country | Store | Department and city reset, department list loads (CO: DIVIPOLA; other: states or text); dial code follows unless touched |
| Select department | CO | City resets, city list = that department's municipalities |
| Open city combobox | No department yet | Disabled with hint "Selecciona primero el departamento" |
| Change dial code by hand | Any | Later country changes do not overwrite it |
| Type letters in phone | Any | Non-digits are stripped as typed (a pasted "+57 300-123" keeps only digits; a leading +57 equal to the dial code is dropped) |
| Tab / Shift+Tab | Any form | Order: name → email → dial → number → country → department → city → address → notes → Pay (reverse with Shift+Tab); combobox opens with Enter/Space/ArrowDown, Esc closes and returns focus to the trigger |
| Geo lookup fails | Any | Defaults stay CO / +57 |
| Country without states (e.g. AW) | Store | State and city are text inputs, state optional |
| 320–375 px width | All | Dial + number on one row without horizontal scroll; rows stack in one column |

## Test Tasks

- `tests/checkout-fields.test.ts` and `tests/bold-prefill.test.ts` (node test runner, Commit A): phone rules, parse/format round trip, email, prefill JSON shape.
- Regression smoke (after Commit D, local): add to cart → `/checkout` → Bold opens; ticket purchase → Bold opens; free event → redirect to `/entradas/<token>`; donation Bold → Bold opens; donation PayPal button renders. The confirm flow is untouched, so no confirm curl changes.

## Validation Checklist

- [ ] **Level 1 — Lint & Format:** none in this project (no linter). `npm test` for the pure helpers.
- [ ] **Level 2 — Type Check:** `npm run check` (astro build + tsc + wrangler dry-run)
- [ ] **Level 2.5 — Code Review:** `code-review` skill on the branch diff (money path: strongest model), then one fresh-context branch review before the PR (orchestrator rule). Save it as an artifact for the report.
- [ ] **Level 3 — Unit Tests:** `npm test`
- [ ] **Level 4 — Integration (curl against `astro dev`, not `wrangler dev`, with `.dev.vars` copied):**
  - `POST /api/store/checkout` with a valid cart but: no phone → 400; phone `"+57 123"` → 400; no city → 400; no address → 400; CO without department → 400; `countryCode:"Colombia"` → 400; full valid → 201 with `orderId` `AFROIN-ORD-…`; the D1 row has `customer_phone = "+57 3001234567"`.
  - `POST /api/tickets/checkout` (seeded event slug): no phone → 400; valid → 201 (or `free`).
  - `POST /api/bold-firma`: no phone → 400; valid → 200/201 with `orderId`.
  - `POST /api/donante` without phone → still accepted (unchanged).
  - Price tamper: cart line with `price: 1` → amount still from D1 (rule 1 regression).
- [ ] **Level 5 — Human Review (Julio, on the branch Preview `https://<branch>.afroin.org`, Bold TEST keys, before merge to `dev`):** desktop and mobile:
  - Store: empty Pay shows errors; CO → Magdalena → Santa Marta; non-CO country with states and one without; Bold checkout opens **prefilled** (name, email, phone, address); finish one TEST payment and land on `/pedido`.
  - Tickets: phone required, Bold prefilled.
  - Donation: step-1 inline errors, Bold prefilled; PayPal button renders (no PayPal payment).
  - Country/department/city fields look consistent with the other inputs.
  - If skipped: whether Bold actually shows the prefill, and the mobile layout, ship unobserved.

## Acceptance Criteria

- [ ] Bold opens with name, email, phone (national digits) and dial code prefilled in all three checkouts. The store also sends the billing address (unless Task 0 rules it out).
- [ ] Pressing Pay/Next with missing data marks every invalid field and focuses the first one. No request is sent.
- [ ] The store country field is styled like the other inputs on desktop and mobile.
- [ ] Store: Colombia shows DIVIPOLA departments and their municipalities. Other countries show their states (or text) with city as text.
- [ ] Phone is required in all three forms. The server rejects missing or invalid phone in store, tickets and `bold-firma`.
- [ ] `npm run check` and `npm test` pass, and the curl matrix matches.
- [ ] No change to prices, amounts, the confirm flow or the webhook.

## Confidence Score: 7/10

- **Strengths:** all data sources verified (counts, shapes, licenses). Current code read with line numbers. No migration. The test runner needs no dependency.
- **Uncertainties:** Bold's real behavior with `dialCode`/`billingAddress` (no documented limits). The exact `allCountries` tuple encoding. The cmdk combobox inside the donation's vanilla-JS step. Visual polish iterations.
- **Mitigations:** Task 0 spike with a fallback. Read `data.d.ts` before Task 7. Hidden-input + `change`-event pattern already proven by `CountryCombobox`. UX budget of 3 iterations.

## Notes for Executing Agent

- Run `astro dev` (not `wrangler dev`) from the worktree. Copy `.dev.vars` from the main checkout (already done once). Local D1 is set up (migrations + `seeds/local.sql` applied with `--local --env local`). Never pass `--env local` with `--remote`.
- No credentials in commits (public repo). `.dev.vars` is gitignored.
- Money path: code review per phase and a fresh-context review before the PR.
- Payments only in local or on this branch's Preview, Bold TEST mode.
- Any product question (copy wording, which fields are required) → stop and ask Julio.

> **UI Styling Note:** UI styling specifications are `[provisional]`. Expect them to change once Julio sees them.
>
> **Expected UX iterations: 3**
