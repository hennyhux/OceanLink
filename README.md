- Displayed balances are based on issued invoices and valid payments, not vehicle monthly rates. Saving a parking rate updates the monthly total and unbilled amount. Staff then choose **Review monthly charges** and explicitly issue the reviewed charges; saving a rate alone never silently creates debt.
- `POST /billing-runs/preview` accepts `{ customer_id, through_date }` and returns a review resource with `id`, vehicle-period `lines`, `total`, `credit_available`, `amount_due_after_credit`, skipped-period count, status and issued invoice numbers. It includes unbilled service periods starting on or before the selected business date. Periods are billed in advance, partial periods are prorated by calendar days, and rates are split at effective-date changes with half-up cent rounding.
- `POST /billing-runs/{id}/issue` accepts `{ apply_credit: boolean }` and an `Idempotency-Key`. It issues immutable invoice snapshots and optionally allocates existing credit to those new invoices in the same transaction. Changes to previewed vehicle/customer versions or financial state require a fresh preview (`412`); billed source periods cannot be issued twice (`409`). Retrying the same operation/key returns the original result.
- The ledger also provides `monthly_parking` (current monthly rates total) and `unbilled_parking` (unissued period charges) as Money values. Neither is included in debt until issuance. Customer account details keep gross invoices and unapplied credit separate from the net balance.
- New receipts initially remain unapplied customer credit. Staff can explicitly apply that credit while issuing reviewed monthly charges. General-purpose payment reallocation and the full invoice/PDF interface are not yet implemented. Customer net balance is outstanding issued invoices minus unapplied credit; last payment excludes reversed receipts and opening-credit adjustments.
# OceanLink Frontend

React + TypeScript frontend for OceanLink, a truck parking management app. See the docs in [.github](.github) for requirements, deployment, and project context.

## Requirements

- Node.js 20.19 or newer (24 LTS recommended)
- npm 10 or newer

On Windows PowerShell, `npm` may be blocked by the execution policy. Use `npm.cmd` instead, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## Setup

```bash
npm install
cp .env.example .env   # optional, defaults work for local development
```

## Run against the real backend

Start the FastAPI backend on `http://localhost:8000`, then:

```bash
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` to the backend so the session cookie stays first party. Change the target with `VITE_DEV_PROXY_TARGET` in `.env`.

Note: the production cookie name `__Host-session_id` requires HTTPS. For local HTTP development the backend needs a dev-mode cookie name without the `__Host-` prefix, or you need a local HTTPS setup. This is an open decision (see [.github/REVIEW.md](.github/REVIEW.md) item 3.3).

## Run with development mocks

There is no backend yet. Mock mode runs the agreed auth contract in the browser using MSW.

```bash
npx msw init public/   # one time, creates public/mockServiceWorker.js
npm run dev:mock
```

A warning banner shows while mocks are on. Mock accounts (synthetic, not real people):

| Email                  | Password            | Role     |
| ---------------------- | ------------------- | -------- |
| `admin@example.com`    | `admin-password`    | admin    |
| `operator@example.com` | `operator-password` | operator |

Rules for mock mode:

- It only runs when `VITE_ENABLE_MOCKS=true` **and** the build is a dev build.
- A production build with `VITE_ENABLE_MOCKS=true` fails on purpose.
- Unmocked `/api` requests fail loudly. There is no silent fallback.
- Mock handlers live in `src/mocks/` and are never imported by production code paths.

### Temporary Amplify demo (synthetic data only)

Use this build only for password-protected testing. It enables the mock API in a
production-optimized bundle; it does not connect to a backend, and mock changes
reset when the page reloads. Never enter real customer data or reuse real
credentials.

Build and package the contents of `dist` so `index.html` is at the ZIP root:

```powershell
npm.cmd run build:demo
tar.exe -a -c -f .\OceanLink-demo.zip -C .\dist index.html assets mockServiceWorker.js
```

In AWS Amplify Hosting, create an app with **Deploy without Git** and upload
`OceanLink-demo.zip`. Add this rewrite under **Rewrites and redirects** so direct
navigation to React routes works:

| Source | Target | Status |
| --- | --- | --- |
| `</^[^.]+$/>` | `/index.html` | `200 (Rewrite)` |

Then enable Amplify access control with a temporary password for testers. The
Amplify password is only an extra demo access barrier; it does not make the
mock data suitable for real customer information.

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Project layout

```
src/
  app/          providers, theme, router, app shell, navigation
  features/     one folder per feature (auth, customers, vehicles, overview, placeholders)
  components/   shared UI pieces (loading, error, language switch, page header, dialogs)
  hooks/        small shared hooks
  lib/          api client, config, i18n, query client
  mocks/        MSW handlers (dev and test only)
  test/         test setup and render helpers
```

## API contract used

From REQUIREMENTS.md section 11.2, base path `/api/v1`:

- `GET /reports/summary` returns the dashboard KPIs: `overdue_invoices`, `outstanding_invoices`, `unbilled_parking`, `payments_received_this_month`, `total_customers`, and `total_trucks`. Counts include inactive records; truck totals count trucks and combinations, excluding standalone trailers. Payment totals exclude reversed receipts.

- `POST /auth/login` with `{ email, password }`
- `GET /auth/session`
- `POST /auth/logout`

Assumptions made where the spec is silent (to confirm against the backend OpenAPI schema):

- Login and session both return `{ user, session: { idle_expires_at, absolute_expires_at } }`.
- User has `id, email, name, role, is_active, preferred_language, must_change_password`.
- Wrong credentials return `401` with code `INVALID_CREDENTIALS`.

Customers (REQUIREMENTS.md sections 10 and 11.3):

- `GET /customers?q=&include_inactive=&page=&page_size=` returns `{ items, page, page_size, total }`. `q` matches name, contact, phone, email, and USDOT.
- `POST /customers` creates one. `GET /customers/{id}` reads one.
- `PATCH /customers/{id}` with `If-Match: "<version>"` updates fields or `is_active`. Stale version returns `412`.
- Duplicate USDOT among active customers returns `409` with code `USDOT_ALREADY_IN_USE`.
- Validation returns `422` with `field_errors: { field: [code] }`.

Assumed customer fields: `id, version, type (business | individual), display_name, contact_name, phone, email, usdot_number, address_line1, address_line2, city, state, postal_code, notes, is_active, created_at, updated_at`. There is no delete; customers are deactivated.

Vehicles (REQUIREMENTS.md sections 7.1, 10 and 11.3):

- `GET /vehicles?q=&customer_id=&include_inactive=&page=&page_size=` returns `{ items, page, page_size, total }`. `q` matches unit number, plate (ignoring spaces and dashes), USDOT, and customer name.
- `POST /vehicles` creates one. `GET /vehicles/{id}` reads one.
- `PATCH /vehicles/{id}` with `If-Match: "<version>"` updates fields or `is_active`. The owner (`customer_id`) is never sent in an edit; changing owner is a separate workflow.
- A vehicle needs a plate with its state, or a USDOT number, or both. A USDOT-only vehicle also needs a unit number.
- Duplicates among active vehicles return `409` with code `PLATE_ALREADY_IN_USE` (same plate and state) or `UNIT_NUMBER_ALREADY_IN_USE` (same USDOT and unit number).
- Validation returns `422` with `field_errors: { field: [code] }`.

Assumed vehicle fields: `id, version, customer_id, customer_name (read-only), vehicle_type (truck | trailer | combination | compact), unit_number, plate_number, plate_jurisdiction, usdot_number, is_active, created_at, updated_at, parking`. `parking` is null until monthly service is configured.

Vehicle monthly parking and customer accounts (proposed schemas, pending backend OpenAPI):

- No separate parking contracts, approval workflow or contract endpoints remain. Old `/agreements` bookmarks redirect to `/vehicles`.
- `POST /vehicles/{id}/parking` with `If-Match` saves `{ pool_id, starts_on, ends_on, monthly_rate: { amount, currency: "USD" }, effective_on, reason }` and returns the updated vehicle. Dates are business dates and service ends are exclusive. Initial effective date equals service start. Each vehicle consumes one compatible capacity unit for the interval.
- Returned `parking` adds `pool_label`, copied `billing_anchor_day` and `payment_terms`, and append-only `rate_history: [{ effective_on, monthly_rate, reason }]`. Reads select the current price by effective date; future prices remain scheduled without rewriting history.
- Customer `billing_anchor_day` (default 1) and `payment_terms` (blank means due at period start) are editable defaults for new parking setups. Changes do not rewrite an existing setup or invoice.
- Existing rate and end-date changes require admin access. New rates must have a future effective date after the last scheduled change. Initial start/category are immutable in ordinary edits. End monthly service before archiving a vehicle; preserve its history and debt.
- `GET /lots/current/capacity-pools` is a proposed configuration dependency: `{ id, label, capacity, allowed_vehicle_types }[]`. The real backend must supply actual categories and enforce interval capacity and compatibility atomically. No production capacity is hardcoded in the frontend.
- `GET /customers/{id}/ledger` returns `{ as_of, outstanding, overdue, unapplied_credit, net_balance, last_payment }`. Monetary fields use `{ amount, currency: "USD" }`. `last_payment` is null or `{ id, amount, effective_on, method }`, selected from valid non-reversed receipts by effective date and a deterministic tie-break. Opening credit is not a payment. Net balance is outstanding minus unapplied credit, calculated by the backend.
- Displayed balances are based on issued invoices and valid payments, not vehicle monthly rates. Saving a rate updates monthly parking and unbilled totals. Staff choose **Review monthly charges** and explicitly issue the reviewed charges before they become debt.
- `POST /billing-runs/preview` accepts `{ customer_id, through_date }` and returns a run with vehicle-period lines, total, available credit, projected net amount due and skipped-period count. It includes unbilled periods starting through the selected date. Periods are billed in advance, partial periods are prorated by calendar days, effective-dated rate changes are honored, and cent amounts use half-up rounding.
- `POST /billing-runs/{id}/issue` accepts `{ apply_credit: boolean }` and `Idempotency-Key`. Issuance creates immutable invoice snapshots and optionally applies existing credit to the new invoices atomically. Changed vehicle/customer versions or financial state require a fresh review (`412`); source periods cannot be billed twice (`409`). Retrying identical content/key returns the original result.
- The ledger also returns `monthly_parking` and `unbilled_parking` as Money values. These are informational until issuance and are not added directly to debt. Full invoice management/PDFs and general-purpose payment reallocation remain unfinished.
- Mock mode uses a synthetic category with capacity 10 and synthetic ledger history for the first demo customer ($150 due, $50 overdue, last payment $300 by bank transfer). Vehicles start without monthly parking. Receipt recording and reversal now update the mock ledger. Data resets on reload; mock effective dates use UTC. This is not a production accounting engine or durable audit store. Real integration remains unverified.
- There are no persisted contract records in this frontend. A future legacy-data migration must preserve source history and obtain explicit per-vehicle price allocations rather than silently splitting combined legacy totals.

Recorded payments (proposed backend contract):

- This workflow records cash/check/transfer/card payments already collected outside OceanLink. It never charges a card or moves money.
- `GET /payments` accepts `customer_id`, `q` (customer name/reference), inclusive business-date `from`/`to`, `method`, `status`, `page`, and `page_size`. Lists use the standard paged shape and sort by effective date, creation timestamp and ID, descending.
- `POST /payments` requires `Idempotency-Key` and `{ customer_id, amount: { amount, currency: "USD" }, effective_on, method, reference, notes }`. Amounts are positive integer cents. Methods: `cash | check | bank_transfer | external_card | other`. Date received cannot be in the future in the configured lot time zone. Existing inactive customers may pay debt.
- `GET /lots/current` supplies the configured `time_zone` and `currency` for the receipt form. The mock uses UTC; production must supply the real lot setting.
- `GET /payments/{id}` returns receipt details including version, customer snapshot, original amount, `allocated_amount`, `available_credit`, effective date, method, reference, notes, `recorded_by`, creation time, `status: received | reversed`, optional reversal metadata and audit events.
- `POST /payments/{id}/reverse` requires an admin, `If-Match`, `Idempotency-Key`, and `{ reason }`. It corrects an erroneous record, preserves history, undoes allocations atomically, and updates balances. It is not a refund. There are no ordinary payment-edit or delete endpoints.
- The backend must enforce staff authorization on every read/write, CSRF checks on browser writes, transactions for receipt/reversal/ledger changes, and idempotency scoped to actor and operation content. Store idempotency records for at least 30 days; reuse with different content returns `409`, stale versions return `412`.
- Receipt writes have a 15-second client timeout. Unknown results lock the entered values and offer an explicit check that reuses the original payload and key. This safely reconciles either a committed request or one that never reached the server. Pending keys stay in memory; closing/reloading is warned against and must be reconciled through history before a new entry.
- New receipts initially remain unapplied customer credit. Staff can explicitly apply that credit when issuing reviewed monthly charges. Customer net balance is outstanding issued invoices minus unapplied credit; last payment excludes reversed receipts and opening-credit adjustments.
- The mock retains a synthetic legacy receivable of $450, including $350 overdue before the seeded $300 payment allocation. New receipt/reversal history is shared with the customer ledger, but is not durable across reloads. Existing read fixtures are development-only; real backend authorization and accounting remain unverified.

The HTTP client sends `credentials: "include"` and `X-Requested-With: XMLHttpRequest` on every write. Session IDs are never stored in JavaScript. The only thing in `localStorage` is the UI language.
