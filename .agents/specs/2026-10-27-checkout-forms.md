# Design: Checkout forms UX (D8)

## Problem

Julio's notes from D1's Level 5 (2026-10-27), checked against the code the same day:

1. **Bold prefill.** All three checkouts (store `CheckoutForm.tsx`, tickets `TicketCheckoutForm.tsx`, donation `Registration.astro`) already send `customerData` with `fullName`, `email` and `phone`. The work-list note "the donation does not" is outdated (5d735a3). The likely reason Bold shows nothing: `phone` goes out as the buyer typed it (spaces, `+57`, dashes) and without `dialCode`. Bold documents `phone` as national digits (`"3040777777"`) plus `dialCode` (`"+57"`). `billingAddress` (`address`, `city`, `state`, `country` as an ISO alpha-2 code) is never sent.
2. **No validation feedback.** The client stops at the first error and shows one message under the pay button. The server does not require city or address for store orders.
3. **Country field renders badly** in the store checkout. `.cc-trigger` styles exist only in `Registration.astro`, so the store's combobox is unstyled.
4. **Department and city are free text.**

## Chosen approach (decided by Julio, 2026-10-27)

| Topic | Decision |
|---|---|
| Colombia | DIVIPOLA (DANE, official): departments → municipalities, generated once into a JSON file in the repo from datos.gov.co |
| Rest of the world | `country-region-data@4.1.0` (MIT, ~630 KB, countries + states/provinces only). **New dependency, approved by Julio.** City is free text. |
| Country with no states in the dataset | State and city fall back to free text |
| Pickers | Searchable combobox for country, department/state and city (same component and look on desktop and mobile) |
| Phone | Dial-code selector (flag + `+57`) that follows the chosen country and can be changed, plus a digits-only number field. Bold receives `phone` + `dialCode`. **Required in all three forms.** Dial-code table: our own small data file, no extra dependency. |
| Location per form | Store: country → department → city → address (shipping). Donation: country (as today). Tickets: no location (as today). |
| Validation | Per-field errors on "Pay": invalid fields get a red border with a message underneath, then scroll and focus go to the first one. After the first attempt each field revalidates as it is edited. The button stays enabled. |

## Design

### Shared pieces (new)

- `src/lib/checkoutFields.ts`: pure validators shared by client and server (name, email, phone digits + dial code, required text with max length). The server stays the authority (rule 1 still covers prices; this covers required fields).
- `src/lib/boldPrefill.ts`: builds `customerData` (and, for the store, `billingAddress`) strings from validated values: `phone` digits only, `dialCode` `+NN`, `country` alpha-2. The three forms call this one helper.
- `src/data/divipola.json`: `{ code, name, municipalities: [{ code, name }] }[]`, names with accents as DANE publishes them (city sent to Bold as is).
- `src/data/dialCodes.ts`: ISO alpha-2 → dial code for the countries in `src/data/countries.ts`.
- `src/components/checkout/Combobox.tsx`: generic searchable combobox, extracted from `CountryCombobox.tsx` (Radix Popover + cmdk, already dependencies). `CountryCombobox` becomes a thin wrapper, so the donation form keeps working.
- `src/components/checkout/PhoneField.tsx`: dial-code combobox + number input.
- `src/components/checkout/LocationFields.tsx`: country → department/state → city cascade. Changing the country clears department and city; changing the department clears city. States load from `country-region-data` and municipalities from DIVIPOLA. The heavy data is dynamically imported on the client so it is not part of the initial page JS.
- Shared field styles (`.ck-field`, error state, combobox trigger) in one stylesheet used by all three forms, which fixes the unstyled country field.

### Per form

- **Store** (`CheckoutForm.tsx`): uses `PhoneField` + `LocationFields`. Sends `country` (alpha-2 code plus name for the order row), `department`, `city`, `address`, `notes`, `phone` (stored as `+57 3001234567`). Bold receives `customerData` + `billingAddress`.
- **Tickets** (`TicketCheckoutForm.tsx`): `PhoneField` (required). Its default dial code comes from the visitor's country (same ipapi lookup the combobox uses today), falling back to `+57`.
- **Donation** (`Registration.astro`, step 1, shared by Bold and PayPal): the phone input is replaced by a `PhoneField` island that writes hidden inputs (the same pattern `CountryCombobox` uses). Step 1 shows per-field errors before moving to step 2. Bold receives the normalized `phone` + `dialCode`. PayPal is unchanged apart from phone now being required.

### Server

- `src/lib/orders.ts`: require phone, city and address. Department is required when the country has states. Reuse `checkoutFields` validators.
- `src/lib/tickets.ts` (`createPendingTicketOrder` only): require phone. Admin courtesy tickets keep phone optional.
- `src/pages/api/bold-firma.ts` and `src/pages/api/donante.ts`: require phone.
- Error responses keep the current `{ error }` shape. The client validates first, so these errors only show if someone bypasses the form.
- No migration: the existing columns hold the values (`customer_phone`/`buyer_phone`/`phone` as `+57 3001234567`, `ship_*` as text).
- The payment confirmation flow (`/api/*/confirm`, webhook, return pages) is untouched.

## Requirements Delta

### ADDED Requirements
- REQ-CHECKOUT-001: Bold prefill: the store, ticket and donation checkouts open Bold with `customerData` (`fullName`, `email`, `phone` as national digits, `dialCode`), and the store also sends `billingAddress` (`address`, `city`, `state`, `country` alpha-2).
  - Scenario: Given a buyer who entered +57 300 123 4567, When Bold opens, Then `customerData.phone` is "3001234567" and `dialCode` is "+57".
- REQ-CHECKOUT-002: Per-field validation before payment.
  - Scenario: Given empty email and city, When the buyer presses Pay, Then both fields show an error, focus moves to email, and no order is created.
- REQ-CHECKOUT-003: Cascading location pickers in the store checkout.
  - Scenario: Given country Colombia, When the buyer picks Antioquia, Then the city list shows only Antioquia's DIVIPOLA municipalities.
  - Scenario: Given a country with no states in the dataset, Then state and city are free-text fields.
- REQ-CHECKOUT-004: Phone is required in store, ticket and donation checkouts, on the client and on the server (admin courtesy tickets excepted).
  - Scenario: Given a POST to `/api/store/checkout` without phone, Then the response is 400 with an error.

## Files Affected

- New: `src/lib/checkoutFields.ts`, `src/lib/boldPrefill.ts`, `src/data/divipola.json`, `src/data/dialCodes.ts`, `src/components/checkout/{Combobox,PhoneField,LocationFields}.tsx`, a shared checkout stylesheet, a one-off script that generates `divipola.json` (kept in `scripts/`).
- Modified: `src/components/CheckoutForm.tsx`, `src/components/TicketCheckoutForm.tsx`, `src/components/CountryCombobox.tsx`, `src/components/Registration.astro`, `src/templates/CheckoutTemplate.astro` (and the ticket template if it passes props), `src/lib/orders.ts`, `src/lib/tickets.ts`, `src/pages/api/bold-firma.ts`, `src/pages/api/donante.ts`, i18n strings (es/en/fr), `package.json`/`package-lock.json`.

## Edge Cases & Risks

- Bold may still ignore some prefill fields, or reject a malformed one (the docs give no limits). Check it in Bold's test checkout on the branch Preview, on desktop and on mobile.
- `country-region-data` names some states differently from DIVIPOLA. We don't mix them: Colombia always uses DIVIPOLA.
- The ipapi geo lookup can fail or be blocked. Default to CO / +57.
- Making phone required in the donation also affects PayPal donors (shared step 1). This is intended (Julio: required in all three).
- Bundle size: the DIVIPOLA and states data load on demand, measured with `npm run check` output.
- `localhost` is http, so Bold opens without `redirectionUrl`. Full flow only on the Preview.

## Open Questions

- None for now. Visual polish follows the existing site look (frontend-design skill). A broader redesign is D9.

## Next Step

Run `/hopla:plan-feature` to create the implementation plan from this design.
