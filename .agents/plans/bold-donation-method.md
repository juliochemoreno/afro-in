# Plan: Bold.co como segundo método de donación

## Overview
Agregar Bold.co (pasarela de pagos colombiana) como segundo método de donación junto al PayPal existente, dentro del formulario "Un Millón de Corazones" (`Registration.astro`). El donante elegirá entre PayPal o Bold. Bold se configura **siempre en COP** y acepta tanto donantes locales (PSE, Nequi, tarjeta) como **internacionales** (tarjeta extranjera): Bold liquida en COP por TRM y, vía **DCC (Dynamic Currency Conversion)**, le muestra automáticamente su moneda al tarjetahabiente extranjero sin que el código haga nada. El flujo de Bold confirma el pago de forma confiable vía webhook + consulta de respaldo server-side, corrigiendo de paso la debilidad del flujo actual de PayPal (que confía solo en el navegador).

## Requirements Summary
- Añadir Bold como método de pago alternativo sin romper el flujo PayPal existente.
- Moneda atada al método: Bold → COP (incluye donantes internacionales vía tarjeta + DCC automático de Bold); PayPal → USD (sin cambios).
- Bold debe aceptar pagos desde otros países: al estar en COP, los extranjeros pagan con tarjeta y Bold/DCC les muestra su moneda automáticamente (sin código adicional). PSE/Nequi siguen disponibles para locales.
- UX: toggle de método en el Paso 2 (PayPal / Bold). SDK del método elegido se carga lazy. Las opciones de monto se reescalan a la moneda del método.
- Firma de integridad de Bold (`SHA-256({orderId}{amount}{currency}{secretKey})`) generada **server-side** (usa la llave secreta — nunca exponer al cliente).
- Confirmación del pago de Bold: webhook (`/api/bold-webhook`) + consulta de respaldo (`GET payment-voucher/{orderId}`) en `/gracias`.
- Persistir proveedor, moneda, identificador de orden Bold y transacción/estado del proveedor en D1. Corregir omisión actual: persistir también el `tx` de PayPal.
- i18n en es/en/fr para las nuevas etiquetas.
- Variables de entorno: `BOLD_API_KEY` (llave de identidad) y `BOLD_SECRET_KEY` (llave secreta).

## Out of Scope
- Autenticación del panel `/admin/donadores` (ya estaba removida; no se toca en este plan más allá de mostrar las columnas nuevas).
- Reescritura del flujo PayPal a server-side (solo se corrige la persistencia del `tx`; el resto del flujo PayPal queda igual).
- Reembolsos, anulaciones o gestión de disputas desde el sitio.
- Recibos por email propios (Bold y PayPal ya envían los suyos).
- Conversión automática de divisa COP↔USD en una sola opción de monto.

## Likely Follow-ups
- Mostrar el método de pago (PayPal/Bold) y la moneda como columnas/filtros en el panel admin.
- Unificar el contador para mostrar recaudo separado por moneda (hoy `contador.ts` suma `amount` sin distinguir USD/COP).
- Migrar PayPal a verificación server-side (webhook/IPN) para igualar la robustez de Bold.
- Mensaje del donante (`message`) persistido en BD — el admin ya lo referencia pero la columna no existe.

## Git Strategy
- **Base branch:** `main` (no existe `origin/develop` ni `origin/dev`; el repo usa GitHub Flow sobre `main`).
- **Feature branch:** `feature/bold-donation-method`

## Context References
Archivos que el agente ejecutor debe leer antes de empezar:
- `src/components/Registration.astro` — formulario de 2 pasos; el Paso 2 (líneas 122-177) y el `<script>` (líneas 527-792) concentran la lógica de montos y PayPal. Aquí va el toggle y la rama Bold.
- `src/pages/api/donante.ts` — endpoint de registro. **Verificado:** inserta `INSERT INTO donors (name,email,phone,country,amount,status) VALUES (...,'pending')` (líneas 30-41). NO persiste `paypal_tx` aunque el cliente lo envía (Registration.astro:714-716).
- `src/pages/api/confirmar.ts` — marca `status='completed'` por `id` filtrando `WHERE id = ? AND status = 'pending'` (líneas 21-27). Idempotente vía `status='pending'`.
- `src/pages/api/contador.ts` — cuenta `status='completed'` y suma `amount` (líneas 11-17). Tras añadir COP, la suma mezcla monedas (ver Gotchas).
- `src/templates/GraciasTemplate.astro` — al cargar lee `sessionStorage.donor_id` y llama `/api/confirmar` (líneas 416-432). Aquí se añade la rama de consulta de respaldo Bold.
- `migrations/0001_create_donantes.sql` — **Verificado:** tabla `donors(id, name, email, phone, country, amount, status DEFAULT 'pending', created_at, completed_at)` + índices `idx_donors_email`, `idx_donors_status`. NO existen columnas `provider`, `currency`, `bold_order_id`, `transaction_id`, `message`, `paypal_tx`.
- `src/pages/admin/donadores.astro` — **Verificado:** `SELECT * FROM donors` (línea 30-32). Su data mock usa estados `pending_payment` y campo `message` que NO existen en la tabla real (líneas 44-82, 229). El estado real es `pending`. Decidir si normalizar (ver Gotchas).
- `wrangler.json` — binding D1 `DB` (database `afroin`, id `1a752558-...`). `compatibility_flags: ["nodejs_compat"]`. `main: ./dist/_worker.js/index.js`.
- `src/i18n/locales/es.json` (líneas 179-185), `en.json`, `fr.json` — claves `join.step2`, `join.form.donate.title`, `join.form.donate.other`, `join.form.secure` (hoy "Pago seguro procesado por PayPal").
- `src/i18n/utils.ts` — `getTranslatedPath(path, lang)` y `useTranslations(lang)`. El SDK de Bold y el `redirectionUrl` deben respetar el idioma activo.
- `package.json` — scripts: `build` (`astro build`), `check` (`astro build && tsc && wrangler deploy --dry-run`), `cf-typegen` (`wrangler types`). **No hay script `test` ni framework de tests.**
- `src/env.d.ts` / `worker-configuration.d.ts` — `Env` es generado por `wrangler types`. Las nuevas vars (`BOLD_API_KEY`, `BOLD_SECRET_KEY`) deben declararse en `wrangler.json`/`.dev.vars` y regenerarse con `npm run cf-typegen`.

## Domain Assumptions
> Confirmar/corregir cada punto antes de ejecutar.
- **Moneda por método:** Bold cobra siempre en **COP** (también para internacionales: pagan con tarjeta y Bold/DCC les muestra su moneda automáticamente, liquidando en COP por TRM); PayPal sigue en **USD**. Un mismo donante no mezcla monedas en una transacción. — confirmado por el usuario.
- **DCC es automático de Bold (cero código):** no se implementa lógica de conversión ni selector de moneda dentro de Bold. Configurar `currency='COP'` es suficiente para que los extranjeros con tarjeta (Mastercard hoy, más franquicias próximamente según Bold) vean su moneda. Las tarjetas internacionales tienen +1% de comisión de Bold (fuera del alcance del código). — confirmado.
- **Montos Bold por defecto:** opciones sugeridas `20.000 / 40.000 / 100.000 COP` + "Otro" (mínimo Bold $1.000 COP). Se eligen estos por paralelismo con las equivalencias que el formulario ya muestra hoy ("~20.000 / ~40.000 / ~100.000 COP"). — confirmar montos.
- **Estado "aprobado" Bold = `completed`:** Bold `APPROVED` se mapea al estado interno `completed` (mismo que PayPal), para que el contador y el admin lo cuenten igual. — confirmar.
- **Estados no terminales Bold (`PROCESSING`, `PENDING`):** se dejan como `pending` interno; solo el webhook/consulta los promueve a `completed` cuando llega `APPROVED`. PSE puede tardar. — confirmar.
- **Estados de rechazo Bold (`REJECTED`, `FAILED`, `VOIDED`):** se marcan como `rejected` interno (nuevo estado), no se cuentan en el contador. — confirmar nombre del estado.
- **El contador suma montos:** hoy `contador.ts` suma `amount` sin importar moneda. Con COP+USD mezclados, `totalAmount` deja de ser significativo. Propuesta: el contador prioriza el **número de donantes** (que sí es agregable) y, si se requiere monto, separarlo por moneda en un follow-up. — confirmar que para v1 basta con el conteo de donantes.

## Requirements Delta

### ADDED Requirements
- REQ-DONATION-001: Método de pago Bold (COP)
  - Scenario: Donante en Colombia — Given el donante está en el Paso 2 del formulario y selecciona la pestaña "🇨🇴 Colombia · Bold", When elige un monto en COP y confirma, Then se abre el checkout de Bold con una firma de integridad válida generada en el servidor y, al aprobarse el pago, su donación queda registrada como `completed`.
- REQ-DONATION-002: Confirmación server-side de pagos Bold
  - Scenario: Webhook — Given Bold procesó una transacción, When Bold notifica a `/api/bold-webhook` con firma válida, Then el donante asociado al `bold_order_id` se marca `completed` (si `APPROVED`) o `rejected` (si `REJECTED/FAILED/VOIDED`) de forma idempotente.
  - Scenario: Respaldo en retorno — Given el donante vuelve a `/gracias` tras pagar con Bold, When la página consulta `GET payment-voucher/{orderId}`, Then confirma el estado real antes de mostrar el agradecimiento, sin depender únicamente del navegador.

### MODIFIED Requirements
- REQ-DONATION-003: Registro de donante incluye proveedor y moneda (reemplaza el registro previo solo-PayPal/USD)
  - El registro de donante ahora persiste `provider` (`paypal|bold`), `currency` (`USD|COP`), el identificador de transacción del proveedor y, para Bold, el `bold_order_id`. El `tx` de PayPal, antes descartado, ahora se persiste.

## Implementation Tasks

### Task 1: Migración D1 — columnas de proveedor/moneda/transacción
- **Action:** create
- **File:** `migrations/0002_add_payment_provider.sql`
- **Pattern:** `migrations/0001_create_donantes.sql` (estilo `CREATE INDEX IF NOT EXISTS`, SQL de D1/SQLite)
- **Details:** Añadir columnas a `donors` con `ALTER TABLE` (SQLite permite una columna por `ALTER`):
  - `ALTER TABLE donors ADD COLUMN provider TEXT NOT NULL DEFAULT 'paypal';`
  - `ALTER TABLE donors ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';`
  - `ALTER TABLE donors ADD COLUMN bold_order_id TEXT;`
  - `ALTER TABLE donors ADD COLUMN transaction_id TEXT;` (tx de PayPal o id de transacción Bold)
  - `ALTER TABLE donors ADD COLUMN provider_status TEXT;` (estado crudo del proveedor: APPROVED/REJECTED/etc.)
  - `CREATE INDEX IF NOT EXISTS idx_donors_bold_order ON donors(bold_order_id);`
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_donors_bold_order_unique ON donors(bold_order_id) WHERE bold_order_id IS NOT NULL;` (garantiza idempotencia del webhook por orden).
- **Gotcha:** SQLite no soporta múltiples columnas en un solo `ALTER TABLE`; usar una sentencia por columna. Los defaults `'paypal'`/`'USD'` mantienen consistentes las filas existentes. El índice único parcial evita duplicados de la misma orden Bold.
- **Validate:** `npx wrangler d1 execute afroin --local --file=./migrations/0002_add_payment_provider.sql` corre sin error; luego `npx wrangler d1 execute afroin --local --command="PRAGMA table_info(donors);"` muestra las columnas nuevas. Para remoto: mismo comando con `--remote` (coordinar con el usuario).

### Task 2: Declarar variables de entorno Bold y tipos
- **Action:** modify
- **File:** `wrangler.json` (+ crear `.dev.vars` localmente para dev)
- **Pattern:** estructura existente de `wrangler.json`
- **Details:**
  - En `wrangler.json` añadir bloque `"vars"` solo para valores NO secretos si aplica; las llaves son secretas, así que en producción se cargan con `wrangler secret put BOLD_API_KEY` y `wrangler secret put BOLD_SECRET_KEY` (documentar, no commitear valores).
  - Crear `.dev.vars` (ya ignorado por git — verificar `.gitignore`) con `BOLD_API_KEY=...` y `BOLD_SECRET_KEY=...` para `astro dev`/`wrangler dev`.
  - Ejecutar `npm run cf-typegen` para regenerar `worker-configuration.d.ts` con las nuevas vars en `Env`.
- **Gotcha:** NUNCA commitear las llaves. `BOLD_SECRET_KEY` solo se usa server-side. Confirmar que `.dev.vars` esté en `.gitignore` (añadirlo si falta). `worker-configuration.d.ts` es generado — no editarlo a mano.
- **Validate:** `npm run cf-typegen` corre sin error y `grep -c "BOLD_API_KEY" worker-configuration.d.ts` ≥ 1. `git check-ignore .dev.vars` devuelve el path (está ignorado).

### Task 3: Helper de firma de integridad Bold (server-side)
- **Action:** create
- **File:** `src/lib/bold.ts`
- **Pattern:** `src/pages/api/donante.ts` (módulo TS del Worker, sin dependencias de Node propias de runtime)
- **Details:** Funciones puras reutilizables por los endpoints:
  - `generateOrderId(): string` — id único sin `Date.now()`/`Math.random()` prohibidos en workflows pero permitidos en runtime normal; usar `crypto.randomUUID()` (disponible en Workers) p. ej. `AFROIN-${crypto.randomUUID()}`.
  - `async generateIntegritySignature(orderId: string, amount: string, currency: string, secretKey: string): Promise<string>` — concatena `` `${orderId}${amount}${currency}${secretKey}` `` y aplica SHA-256 hex vía `crypto.subtle.digest('SHA-256', ...)` (Web Crypto, disponible en Workers). Devuelve hex en minúsculas.
  - Constantes: `BOLD_CHECKOUT_SDK = "https://checkout.bold.co/library/boldPaymentButton.js"`, `BOLD_VOUCHER_API = "https://payments.api.bold.co/v2/payment-voucher"`.
  - `mapBoldStatus(status: string): 'completed' | 'rejected' | 'pending'` — `APPROVED`→`completed`; `REJECTED|FAILED|VOIDED`→`rejected`; `PROCESSING|PENDING|NO_TRANSACTION_FOUND`→`pending`.
- **Gotcha:** El `amount` debe ser **string sin decimales** y EXACTAMENTE el mismo valor que se envía al checkout, o la firma no coincide. El orden de concatenación es fijo: `orderId + amount + currency + secretKey`.
- **Validate:** `npx tsc --noEmit` pasa. Smoke manual: con valores de ejemplo de la doc (`inv0334`/`39400`/`COP`/`kgfq2nN0o52XqnuXZWIN2F`) la firma SHA-256 coincide con la documentada por Bold.

### Task 4: Endpoint POST /api/bold-firma (crear orden + firma + registro pending)
- **Action:** create
- **File:** `src/pages/api/bold-firma.ts`
- **Pattern:** `src/pages/api/donante.ts` (estructura `APIRoute`, `prerender = false`, manejo CORS/OPTIONS, acceso `locals.runtime.env`)
- **Details:**
  - `POST`: recibe `{ name, email, phone?, country?, amount }` (amount en COP, entero string/number).
  - Validar: `name`, `email`, `amount` requeridos; `amount` numérico entero ≥ 1000 (mínimo Bold). Email con formato básico. Rechazar payloads > ~10KB.
  - Generar `orderId` y `integritySignature` con `src/lib/bold.ts` usando `env.BOLD_SECRET_KEY` y `currency='COP'`.
  - `INSERT INTO donors (name,email,phone,country,amount,status,provider,currency,bold_order_id) VALUES (?,?,?,?,?, 'pending','bold','COP',?)`.
  - Responder `{ orderId, integritySignature, apiKey: env.BOLD_API_KEY, amount: String(amount), currency: 'COP', donorId }`.
  - Implementar `OPTIONS` para CORS igual que `donante.ts`.
- **Gotcha:** `env.BOLD_SECRET_KEY` NUNCA debe ir en la respuesta. Solo se devuelve la firma ya calculada y la `apiKey` (llave de identidad, que sí es pública). El `amount` devuelto debe ser el mismo string usado para firmar.
- **Validation:** required: `name` (1-100), `email` (formato), `amount` (entero ≥ 1000). Format: `amount` solo dígitos. Payload máx ~10KB.
- **Error UX:** en el cliente, si la respuesta no es OK, mostrar `showToast(t('join.toast.error'), 'error')` y no abrir el checkout.
- **Validate:** `curl -X POST localhost:4321/api/bold-firma -H 'Content-Type: application/json' -d '{"name":"Test","email":"t@t.co","amount":20000}'` devuelve 201 con `orderId` e `integritySignature` (64 hex chars) y NO incluye la secret key.

### Task 5: Endpoint POST /api/bold-webhook (confirmación server-side idempotente)
- **Action:** create
- **File:** `src/pages/api/bold-webhook.ts`
- **Pattern:** `src/pages/api/confirmar.ts` (UPDATE condicional idempotente sobre `donors`)
- **Details:**
  - `POST`: recibe la notificación de Bold. Leer el **raw body** (`await request.text()`) para verificar firma antes de parsear.
  - Verificar autenticidad con `env.BOLD_SECRET_KEY` según el esquema de Bold (cabecera de firma del webhook). Si no valida → `401`.
  - Extraer `bold_order_id` (identificador de la orden) y el estado de la transacción del payload.
  - Mapear estado con `mapBoldStatus`. `UPDATE donors SET status=?, provider_status=?, transaction_id=?, completed_at=CURRENT_TIMESTAMP WHERE bold_order_id=? AND status='pending'`.
  - Idempotencia: el `WHERE status='pending'` + índice único de `bold_order_id` evita doble conteo si Bold reintenta. Responder `200` siempre que la firma sea válida (aunque ya estuviera procesada), para que Bold no reintente indefinidamente.
- **Gotcha:** El webhook llega SIN cookies/sesión; la única autenticación es la firma. Verificar contra el **raw body**, no el JSON re-serializado. Bold reintenta ante no-2xx: el handler debe ser idempotente y responder 200 ante duplicados ya procesados.
- **Validation:** required: cabecera de firma válida; body con identificador de orden y estado. Sin firma válida → 401 sin tocar BD.
- **Error UX:** N/A (endpoint servidor-a-servidor; sin UI). Loguear con `console.error` para observabilidad (ya habilitada en `wrangler.json`).
- **Validate:** `npx tsc --noEmit` pasa. Simular con `curl` un payload firmado de prueba y verificar que un `bold_order_id` en estado `pending` pasa a `completed`; un segundo POST idéntico no cambia nada (idempotente).
- **Time-box:** 45 min para la verificación de firma del webhook. Si el esquema exacto de firma de Bold no está claro en la doc, fallback: validar por consulta server-side a `payment-voucher/{orderId}` (no confiar en el payload) y dejar el webhook como disparador, registrando un TODO para endurecer la verificación de firma.

### Task 6: Consulta de respaldo Bold en /gracias
- **Action:** modify
- **File:** `src/templates/GraciasTemplate.astro`
- **Pattern:** bloque `<script>` existente (líneas 416-447) que confirma PayPal vía `sessionStorage` + `/api/confirmar`
- **Details:**
  - Detectar retorno de Bold por query param del `redirectionUrl` (Bold añade parámetros de orden/estado al volver) o por `sessionStorage.setItem('bold_order_id', ...)` guardado en el Paso 2.
  - Si hay `bold_order_id`, llamar a un endpoint server-side de respaldo (Task 5b, ver abajo) que consulte `GET payment-voucher/{orderId}` con la `x-api-key` y actualice el estado (no exponer la api-key en el cliente). Luego limpiar el `sessionStorage`.
  - Mantener intacta la rama PayPal (`donor_id` → `/api/confirmar`).
- **Gotcha:** La consulta a Bold requiere la llave de identidad en la cabecera `Authorization: x-api-key` → debe hacerse server-side, no desde el navegador. Por eso se enruta a un endpoint propio. El estado puede ser `PENDING` (PSE) al volver: mostrar "pago en verificación" en vez de "completado" si aún no está `APPROVED`.
- **Validate:** al volver a `/gracias?bold_order_id=...` con una orden aprobada de prueba, el donante queda `completed` y el contador refleja +1.

### Task 5b: Endpoint POST /api/bold-confirmar (consulta de respaldo server-side)
- **Action:** create
- **File:** `src/pages/api/bold-confirmar.ts`
- **Pattern:** `src/pages/api/confirmar.ts`
- **Details:**
  - `POST { orderId }`: hace `GET https://payments.api.bold.co/v2/payment-voucher/{orderId}` con header `Authorization: x-api-key ${env.BOLD_API_KEY}`.
  - Mapear el estado devuelto con `mapBoldStatus` y aplicar el mismo `UPDATE ... WHERE bold_order_id=? AND status='pending'`.
  - Responder `{ status, totalDonors }` (como `confirmar.ts`).
- **Gotcha:** Es la red de seguridad si el webhook no llegó aún. Debe ser idempotente y consistente con el webhook (mismo UPDATE condicional). No marcar `completed` si Bold no devuelve `APPROVED`.
- **Validation:** required: `orderId`. Si Bold devuelve `NO_TRANSACTION_FOUND` → no cambiar estado, responder estado `pending`.
- **Error UX:** en `/gracias`, si el estado no es `APPROVED`, mostrar copy "Tu pago está en verificación" en lugar de error duro.
- **Validate:** `curl -X POST localhost:4321/api/bold-confirmar -d '{"orderId":"..."}'` devuelve el estado y NO expone la api-key.

### Task 7: Persistir el tx de PayPal (corrección de omisión actual)
- **Action:** modify
- **File:** `src/pages/api/donante.ts`
- **Pattern:** el propio `INSERT` actual (líneas 30-41)
- **Details:**
  - Extender `DonorData` con `paypal_tx?: string` y `paypal_status?: string` (ya los envía el cliente, Registration.astro:714-716).
  - Cambiar el `INSERT` para incluir `provider='paypal'`, `currency='USD'`, `transaction_id = paypal_tx`, `provider_status = paypal_status`.
  - Mantener `status='pending'` y el resto del flujo igual (PayPal sigue confirmando vía `/api/confirmar`).
- **Gotcha:** No cambiar la firma de respuesta (`{ success, id }`) — `Registration.astro` depende de `data.id`. Solo se añaden columnas al INSERT.
- **Validate:** `curl` POST con `paypal_tx` y verificar que la fila guarda `provider='paypal'`, `currency='USD'`, `transaction_id` poblado.

### Task 8: UI — toggle de método y rama Bold en Registration.astro
- **Action:** modify
- **File:** `src/components/Registration.astro`
- **Pattern:** estructura del Paso 2 (líneas 122-177) y el `<script>` con la lógica PayPal (líneas 629-792)
- **Details:**
  - Añadir, al inicio del Paso 2, un toggle/segmented control de método: `${t('join.method.paypal')}` / `${t('join.method.bold')}`. Bold se presenta como opción válida para cualquier país (acepta tarjeta local e internacional + PSE/Nequi). Preselección por defecto: Bold (cubre el mayor rango de donantes); opcionalmente, dejar PayPal preseleccionado si el país detectado no es `CO`. — `[provisional]`
  - Renderizar DOS conjuntos de opciones de monto: el actual en USD (PayPal) y uno nuevo en COP (Bold: 20.000/40.000/100.000/Otro, mín 1000). Mostrar solo el del método activo.
  - Contenedor `#bold-pay-container` análogo a `#paypal-donate-container`.
  - Lazy-load del SDK de Bold (`checkout.bold.co/library/boldPaymentButton.js`) solo al activar la pestaña Bold (igual patrón que `loadPayPalSDK`).
  - Flujo Bold al confirmar: validar Paso 1 → `POST /api/bold-firma` con `{name,email,phone,country,amount}` → con la respuesta, instanciar `new window.BoldCheckout({ orderId, currency:'COP', amount, apiKey, integritySignature, description:'Aporte AFRO IN - Millón de Corazones', redirectionUrl })` y llamar `.open()`. Guardar `bold_order_id` en `sessionStorage`. `redirectionUrl` = URL absoluta a `/gracias` traducida con `getTranslatedPath('/gracias', lang)`.
  - Reescalar/re-firmar: como la firma depende del monto, NO firmar hasta que el usuario confirme el pago (a diferencia de PayPal que renderiza el botón por monto). El botón Bold dispara primero `/api/bold-firma` con el monto elegido y luego abre el checkout.
  - Actualizar la nota de seguridad (`join.form.secure`) según método activo.
- **Gotcha:** Bold NO permite encerrarse en iframe (el sitio no usa iframe, ok). El `amount` enviado a `/api/bold-firma` y el `amount` pasado a `BoldCheckout` deben ser el MISMO string que se firmó. No cargar ambos SDKs a la vez. Mantener `astro:page-load` (View Transitions) — re-inicializar listeners en cada navegación como ya hace el script.
- **Validation:** monto Bold entero ≥ 1000 COP antes de llamar a `/api/bold-firma`; si "Otro" < 1000 → toast de error y no abrir checkout.
- **Error UX:** `showToast(t('join.toast.error'), 'error')` si falla la validación o `/api/bold-firma`.
- **Validate:** `npm run build` compila; en dev, seleccionar pestaña Bold, elegir monto, confirmar → se abre el modal de Bold con el monto correcto.
- **Time-box:** 90 min para integrar el SDK `BoldCheckout` (API externa). Si el constructor/método de apertura difiere de lo documentado, fallback: usar el botón estándar `data-bold-button` inyectado dinámicamente con los `data-*` atributos (`data-api-key`, `data-amount`, `data-currency='COP'`, `data-order-id`, `data-integrity-signature`, `data-redirection-url`).

### Task 9: i18n — nuevas claves en es/en/fr
- **Action:** modify
- **File:** `src/i18n/locales/es.json`, `src/i18n/locales/en.json`, `src/i18n/locales/fr.json`
- **Pattern:** claves `join.*` existentes (es.json:179-185)
- **Details:** Añadir (con traducciones por idioma):
  - `join.method.label` — "Elige tu método de pago" / "Choose your payment method" / "Choisissez votre moyen de paiement".
  - `join.method.paypal` — "PayPal" / "PayPal" / "PayPal" (subtítulo opcional: "Saldo PayPal o tarjeta").
  - `join.method.bold` — "Tarjeta, PSE o Nequi" / "Card, PSE or Nequi" / "Carte, PSE ou Nequi" (Bold; válido para pagos locales e internacionales con tarjeta).
  - `join.method.bold.hint` — "Acepta tarjetas de Colombia y del exterior" / "Accepts cards from Colombia and abroad" / "Accepte les cartes de Colombie et de l'étranger".
  - `join.form.secure.paypal` — copy actual de `join.form.secure` (PayPal).
  - `join.form.secure.bold` — "🔒 Pago seguro procesado por Bold" / "🔒 Secure payment processed by Bold" / "🔒 Paiement sécurisé traité par Bold".
  - `join.form.amount.min` — mensaje de monto mínimo COP.
  - `join.bold.verifying` — "Tu pago está en verificación…" (para PSE pendiente).
  - Mantener `join.form.secure` existente para compatibilidad o reemplazar usos.
- **Gotcha:** Si se usa `ui.ts` como índice de claves tipadas, verificar que las nuevas claves se reflejen ahí (la firma de `useTranslations` tipa `key` contra `ui[defaultLang]`). Revisar si `ui.ts` importa los JSON o define claves manualmente.
- **Validate:** `npm run build` no arroja errores de tipo por claves faltantes; las tres páginas (`/unirse`, `/en/join`, `/fr/rejoindre`) muestran las etiquetas correctas.

### Task 10: Admin — mostrar proveedor/moneda y normalizar estado
- **Action:** modify
- **File:** `src/pages/admin/donadores.astro`
- **Pattern:** tabla y badges existentes (líneas 173-251, 435-456)
- **Details:**
  - Añadir columna "Método" (provider: PayPal/Bold) y mostrar moneda junto al monto (`formatCurrency` hoy fuerza COP; usar la moneda de la fila: COP con `Intl` es-CO, USD con en-US).
  - Corregir el badge de estado: la BD usa `pending`/`completed`/`rejected`, pero el código compara contra `pending_payment`. Normalizar a los estados reales y añadir `rejected`.
  - Quitar/condicionar la columna `message` (no existe en la tabla) o dejarla tolerante a `undefined` (ya lo es), pero idealmente removerla de los headers para no confundir.
- **Gotcha:** `formatCurrency` está fijo a COP (líneas 88-94). Para filas USD el monto se vería inflado. Parametrizar por `donor.currency`.
- **Validate:** `npm run build` compila; la tabla muestra método y moneda correctos para filas de ambos proveedores.

## Interaction Matrix

| Action | Context | Expected Behavior |
|--------|---------|-------------------|
| Click pestaña "Bold" | Paso 2, método actual = PayPal | Oculta opciones USD + botón PayPal; muestra opciones COP; carga lazy SDK Bold |
| Click pestaña "PayPal" | Paso 2, método actual = Bold | Oculta opciones COP; muestra opciones USD + botón PayPal (comportamiento actual intacto) |
| Cambiar monto | Método = Bold | Actualiza el monto que se enviará a `/api/bold-firma` al confirmar (no se firma hasta confirmar) |
| Seleccionar "Otro" < 1000 COP | Método = Bold | Toast de error `join.form.amount.min`; no abre checkout |
| Click "Confirmar/Donar" | Método = Bold, datos válidos | `POST /api/bold-firma` → `BoldCheckout.open()` con firma válida |
| Volver del checkout | `/gracias` con `bold_order_id` | Consulta server-side de estado; `completed` → agradecimiento; `pending` (PSE) → copy "en verificación" |
| Entrada al Paso 2 | Cualquier país | Pestaña Bold preseleccionada por defecto (cubre local + internacional) — provisional |
| Donante internacional con tarjeta extranjera | Checkout Bold (COP) | Bold/DCC ofrece automáticamente pagar en su moneda o en COP (sin código nuestro) |

## Test Tasks

### Task 11: Verificación manual + smoke de regresión PayPal
- **Action:** create (checklist de verificación, no hay framework de tests en el proyecto)
- **File:** N/A (el proyecto no tiene runner de tests; `package.json` no define `test`)
- **Pattern:** N/A
- **Details:** Como no hay infraestructura de tests automatizados, documentar y ejecutar manualmente:
  1. **Regresión PayPal:** flujo completo PayPal en `/unirse` sigue funcionando (montos USD, botón, redirect a `/gracias`, contador +1, fila `provider='paypal'` con `transaction_id` ahora poblado).
  2. **Bold happy path:** pestaña Bold → monto COP → checkout Bold abre con monto correcto → (sandbox) aprobar → webhook marca `completed` → `/gracias` confirma → contador +1.
  3. **Bold firma:** verificar manualmente con el ejemplo de la doc de Bold que `generateIntegritySignature` produce el hash esperado.
  4. **Idempotencia webhook:** doble POST del mismo evento no duplica el conteo.
  5. **i18n:** las tres rutas (`/unirse`, `/en/join`, `/fr/rejoindre`) muestran etiquetas correctas.
- **Gotcha:** Bold exige dominio público para el webhook; el webhook no se puede probar 100% en `localhost` sin túnel. Usar `wrangler dev` + un túnel (o entorno de preview) para la prueba E2E del webhook, o probar la rama de consulta de respaldo (`/api/bold-confirmar`) que sí funciona bajo demanda.
- **Validate:** checklist completado y registrado en el reporte de ejecución.

## Validation Checklist
Ejecutar en orden — no avanzar si un nivel falla:
- [ ] **Level 1 — Lint & Format:** (no hay linter dedicado; usar `npm run build` como gate de formato/compilación de Astro)
- [ ] **Level 2 — Type Check:** `npx tsc --noEmit` (o `npm run check`, que hace `astro build && tsc && wrangler deploy --dry-run`)
- [ ] **Level 2.5 — Code Review:** ejecutar el skill `code-review` sobre los archivos cambiados (foco: que `BOLD_SECRET_KEY` no se filtre al cliente, idempotencia del webhook, verificación de firma)
- [ ] **Level 3 — Unit Tests:** N/A (proyecto sin framework de tests) — justificado en Task 11
- [ ] **Level 4 — Integration:** `curl` a `/api/bold-firma`, `/api/bold-confirmar`, `/api/donante`; verificar columnas en D1 con `wrangler d1 execute afroin --local --command="SELECT provider,currency,status,bold_order_id,transaction_id FROM donors ORDER BY id DESC LIMIT 5;"`
- [ ] **Level 5 — Human Review:** flujos PayPal y Bold verificados manualmente según Task 11

## Acceptance Criteria
- [ ] El donante puede elegir entre PayPal (USD) y Bold (COP) en el Paso 2 sin que el flujo PayPal existente cambie.
- [ ] La firma de integridad de Bold se genera server-side y `BOLD_SECRET_KEY` nunca aparece en respuestas ni en el bundle del cliente.
- [ ] Un pago Bold aprobado queda `completed` vía webhook y/o consulta de respaldo en `/gracias`, de forma idempotente.
- [ ] La tabla `donors` persiste `provider`, `currency`, `bold_order_id`, `transaction_id` y `provider_status`; el `tx` de PayPal ahora se guarda.
- [ ] Las etiquetas nuevas existen en es/en/fr y se muestran correctamente en las tres rutas.
- [ ] El panel admin muestra método y moneda correctos y usa los estados reales (`pending`/`completed`/`rejected`).
- [ ] `npx tsc --noEmit` y `npm run build` pasan sin errores.

## Confidence Score: 7/10
- **Strengths:** Arquitectura de donaciones actual entendida y verificada (archivos + líneas). Documentación de Bold investigada (firma, endpoints, estados, monto mínimo). Patrones de endpoint/i18n ya existen y se replican. Decisiones de producto (moneda por método, UX toggle, webhook+consulta) confirmadas con el usuario.
- **Uncertainties:** (1) Esquema exacto de verificación de firma del **webhook** de Bold no 100% confirmado en la doc leída. (2) Forma precisa del payload del webhook y de los query params que Bold añade al `redirectionUrl`. (3) API exacta del constructor `BoldCheckout` (nombres de callbacks). (4) Si `ui.ts` tipa las claves i18n manualmente o importa los JSON.
- **Mitigations:** Time-boxes con fallback en Tasks 5 y 8 (consulta server-side como red de seguridad si el webhook/firma no cierra; botón estándar `data-bold-button` si el constructor difiere). La consulta de respaldo `/api/bold-confirmar` hace el sistema funcional aunque el webhook no esté perfecto. Verificar `ui.ts` al inicio de Task 9. Pedir al usuario el payload de ejemplo del webhook desde su panel de Bold antes de Task 5.

## Notes for Executing Agent
- **Seguridad primero:** `BOLD_SECRET_KEY` solo server-side (firma + verificación webhook). La `BOLD_API_KEY` (llave de identidad) puede ir al cliente para el checkout, pero la consulta `payment-voucher` con `x-api-key` debe hacerse server-side (Task 5b). Nunca devolver la secret key en una respuesta JSON.
- **No romper PayPal:** todo el flujo PayPal (montos USD, SDK donate, `/api/donante`→`/api/confirmar`) debe seguir igual; las únicas modificaciones a su ruta son aditivas (persistir `provider/currency/transaction_id`).
- **Idempotencia:** webhook y consulta de respaldo comparten el mismo `UPDATE ... WHERE bold_order_id=? AND status='pending'` + índice único parcial. Evita doble conteo.
- **Dependencia del usuario antes de ejecutar:** confirmar los Domain Assumptions (montos COP, mapeo de estados, contador por conteo). Para probar el webhook E2E se necesita la URL pública configurada en el panel de Bold y un payload de ejemplo del webhook.
- **Migración remota:** la migración `0002` debe aplicarse también en D1 remoto (`--remote`) coordinando con el usuario antes del deploy.

> **UI Styling Note:** Las especificaciones de estilo (toggle, colores de pestañas, orden de montos, copys) son `[provisional]` — esperar ajustes cuando el usuario vea la implementación. Implementar como se especifica sin sobre-invertir en pixel-perfect.
>
> **Expected UX iterations: 3** — el toggle de método, el reescalado de montos COP y los copys por método suelen requerir 2-4 pasadas de ajuste durante el smoke manual.
