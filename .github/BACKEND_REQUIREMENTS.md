# OceanLink Backend Requirements (Python FastAPI)

**Version:** 0.1 (draft)
**Scope:** MVP 1 backend: staff login, customers, vehicles, vehicle monthly parking, billing, recorded payments, balances, and the dashboard.
**Status:** Planned. No backend code exists yet.

This document turns the shared product rules into a build list for the FastAPI service. It does not replace the other documents:

- [REQUIREMENTS.md](REQUIREMENTS.md): business rules, permissions, and the full endpoint list. It wins on business rules.
- [DEPLOYMENT.md](DEPLOYMENT.md): hosting, backups, and releases. It wins on operations.
- [GLOBAL_CONTEXT.md](GLOBAL_CONTEXT.md): decisions and conventions.
- The frontend code in this repository: the exact wire shapes the app already calls. Section 6 lists them. The development mocks in `src/mocks/` show the intended behavior and can be used as executable examples, but they are not an accounting engine.

When this document and the frontend code disagree, raise it in section 12 instead of guessing.

Requirement IDs (`BE-xx`) are used so issues and pull requests can reference them.

---

## 1. Goals

The backend must let the owners trust the numbers. In priority order:

1. **Correct money.** Balances, invoices, and payments always add up to the cent. Nothing is counted twice.
2. **Nothing is lost.** Financial records are never edited in place or deleted. Every change has an actor, a reason where required, and an audit event.
3. **Safe retries.** A slow network or a double tap never creates a second payment, invoice, or charge.
4. **Simple to run.** One server, one SQLite file, one process to restart.

## 2. Technology

| Area | Choice | Notes |
| --- | --- | --- |
| Language | Python 3.12 or newer | Pin the exact version in the project. |
| Web framework | FastAPI | Serves OpenAPI at `/openapi.json` and docs at `/docs` (docs disabled or admin-only in production). |
| Validation | Pydantic v2 | Separate read and write models. Write models forbid extra fields. |
| Database | SQLite in WAL mode | One file on encrypted persistent disk. See section 9. |
| Data access | SQLAlchemy 2.0 | Typed models. Explicit transactions. |
| Migrations | Alembic | Versioned, applied once per release under a lock. |
| Password hashing | Argon2id (`argon2-cffi`) | Salted, with rehash on login when parameters change. |
| Server | Uvicorn behind a reverse proxy (Caddy or nginx) | HTTPS ends at the proxy. Uvicorn listens on localhost only. |
| PDF (later in MVP 1) | Decide when invoice PDFs are built | Must render Chinese text. |
| Dependency lock | `uv` (or `pip-tools`) | Locked, hashed dependencies. No unbounded versions. |
| Tests | `pytest`, `httpx` test client | See section 10. |
| Lint and types | `ruff`, `mypy` or `pyright` in strict mode | Run in CI. |

No external queue, cache, or message broker (REQUIREMENTS 1.1).

**Suggested layout**

```
app/
  main.py            app factory, middleware, error handlers
  config.py          settings from environment
  db.py              engine, session, transaction helpers
  auth/              login, sessions, CSRF, roles
  customers/
  vehicles/          vehicle records and monthly parking setup
  billing/           billing runs, invoices, proration
  payments/          receipts, reversals, allocations, credit
  ledger/            balance calculations shared by customers and reports
  reports/
  audit/
  idempotency/
  cli.py             bootstrap admin, seed lot, backup, recovery
migrations/
tests/
```

Each feature folder keeps its router, schemas, service logic, and tables together. Money and balance math lives in one place (`ledger/`) so the customer page, customer list, and dashboard always agree.

---

## 3. Shared API conventions

**BE-01 Base path and format**

- All routes live under `/api/v1`. The frontend sets `VITE_API_BASE_URL=/api/v1`.
- JSON in and out, `snake_case` field names.
- IDs are UUIDs (version 4 or 7).
- Instants are UTC ISO 8601 strings, for example `2026-10-24T03:08:20Z`.
- Business dates are `YYYY-MM-DD` and mean a calendar day in the lot's time zone.
- "Today" always means today in the lot's configured time zone, never the server clock's zone.

**BE-02 Money**

- Money is always `{ "amount": <integer cents>, "currency": "USD" }`.
- Store cents as integers. Never use floats.
- Use `Decimal` for intermediate math (proration), then round once at the end with half-up rounding.
- Maximum single amount: 999,999,999 cents. Amounts entered by staff must be positive.

**BE-03 Lists**

- Query parameters `page` (default 1) and `page_size` (default 20, max 100).
- Response shape: `{ "items": [...], "page": 1, "page_size": 20, "total": 57 }`.
- Sorting is deterministic. Always end with `id` as a final tie-breaker.
- Filters are applied before paging, so `total` counts filtered results.

**BE-04 Errors**

Every error body uses this shape (REQUIREMENTS 12.3):

```json
{
  "code": "USDOT_ALREADY_IN_USE",
  "message": "Another active customer has this USDOT number",
  "request_id": "01JB...",
  "field_errors": { "usdot_number": ["USDOT_ALREADY_IN_USE"] },
  "details": {}
}
```

- `code` is stable and in `UPPER_SNAKE_CASE`. The frontend reacts to `code`, never `message`.
- `message` is safe English fallback text with no customer data.
- `field_errors` maps a field name to a list of codes. Use codes, not sentences.
- FastAPI and Pydantic validation errors (normally `{ "detail": [...] }`) must be rewritten into this shape with `code: "VALIDATION_FAILED"` and status `422`.
- Unhandled exceptions return `500` with `code: "INTERNAL_ERROR"` and no stack trace.
- Every response, success or error, includes an `X-Request-ID` header matching `request_id`.

Status codes follow REQUIREMENTS 12.3, plus one addition used by the frontend mocks:

| Status | Use |
| --- | --- |
| 428 | `If-Match` header missing on a write that requires it (`IF_MATCH_REQUIRED`) |

**BE-05 Versions and stale writes**

- Every mutable record has an integer `version` starting at 1. Each successful change adds 1.
- Edits send `If-Match: "<version>"` (quoted, like an ETag).
- Missing header: `428 IF_MATCH_REQUIRED`. Wrong version: `412 STALE_VERSION`.
- The version check and the update happen in the same transaction (`UPDATE ... WHERE id = ? AND version = ?`).

**BE-06 Idempotency**

Required on: recording a payment, reversing a payment, creating a manual invoice draft, issuing an invoice, and issuing a billing run (later: credits, refunds, imports, check-in/out).

- Header: `Idempotency-Key`, 1 to 200 characters. Missing or too long: `400 IDEMPOTENCY_REQUIRED`.
- The key is scoped to the actor (staff user) and the operation.
- Store a hash of the operation name, path parameters, `If-Match` value, and normalized request body.
- Same key, same content: return the original status code and the current state of the original resource. Do not run the operation again.
- Same key, different content: `409 IDEMPOTENCY_CONFLICT`.
- Two identical requests arriving at once: the second waits for the first or receives the first result. It never runs a second time.
- The idempotency record is written in the same transaction as the business change, so a crash cannot leave one without the other.
- Keep records for at least 30 days.
- Business uniqueness rules still apply on their own (for example a vehicle period can only be billed once), so a new key cannot create a duplicate charge either.

**BE-07 Caching**

All authenticated responses send `Cache-Control: private, no-store`.

---

## 4. Authentication and security

**BE-10 Sessions** (REQUIREMENTS 13.1, 13.2)

- Server-side sessions stored in the database. The cookie only holds a random ID (at least 32 bytes from `secrets`).
- Store a hash of the session ID, not the raw value.
- Production cookie: `__Host-session_id`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`.
- Local development over plain HTTP cannot use `__Host-` or `Secure`. Make the cookie name and `Secure` flag configurable (section 9) and refuse to start in production with the development values.
- Idle timeout 30 minutes, absolute lifetime 8 hours. Both enforced on every request.
- Only deliberate actions extend idle time: writes and `POST /auth/activity`. Ordinary `GET` requests (polling, background refetches) do not.
- Login creates a new session ID. Logout deletes the session and clears the cookie.
- Deactivating a user, changing their role, or resetting their password ends all of their sessions.

**BE-11 CSRF checks on every write** (REQUIREMENTS 13.3)

For `POST`, `PATCH`, `PUT`, and `DELETE`, reject with `403 CSRF_REJECTED` unless:

- `X-Requested-With: XMLHttpRequest` is present,
- `Origin` (or an approved `Referer` fallback) is in the configured allowlist, and
- `Content-Type` is `application/json` when there is a body.

This applies to `POST /auth/login` too. Do not enable CORS in production. The app and API share one origin.

**BE-12 Roles**

- Roles: `operator` and `admin` (REQUIREMENTS 2.1). Drivers come in MVP 3.
- Every route declares its role through a FastAPI dependency. A route without one must fail a test.
- Missing or expired session: `401 SESSION_EXPIRED`. Signed in without permission: `403 FORBIDDEN` (or a more specific code such as `ADMIN_REQUIRED`).
- Users with `must_change_password: true` can only call session, logout, and change-password routes until they change it.
- The last active admin cannot be deactivated or demoted.

**BE-13 Passwords and login**

- Argon2id hashing. Never log passwords.
- Rate-limit login by account and by client IP (for example 5 failures per 15 minutes per account). Return `429 RATE_LIMITED` with a `Retry-After` header.
- Wrong email or wrong password both return `401 INVALID_CREDENTIALS` with the same message and similar timing.
- Inactive account: `403 ACCOUNT_INACTIVE`.

**BE-14 Bootstrap and recovery**

- A CLI command creates the first admin (`python -m app.cli create-admin`). It prompts for the password and never takes it as an argument.
- A CLI recovery command can reset an admin password if every admin is locked out. It writes an audit event.

**BE-15 Logging and privacy**

- Structured JSON logs with `request_id`, route, status, duration, and user ID.
- Never log passwords, session IDs, cookies, idempotency payloads, or full request bodies.
- Do not log customer phone numbers, emails, addresses, or plates outside of error investigation tooling.

---

## 5. Data model

All tables have `id` (UUID), `created_at`, and `updated_at`. Mutable tables have `version`. Financial tables are append-only: rows are never deleted, and amounts are never edited after issue.

| Table | Key columns and rules |
| --- | --- |
| `users` | `email` (unique, case-insensitive), `name`, `role`, `is_active`, `preferred_language` (`zh-CN`, `en`, or null), `must_change_password`, `password_hash`. |
| `sessions` | `user_id`, `id_hash`, `created_at`, `last_activity_at`, `absolute_expires_at`, `revoked_at`. |
| `lots` | Exactly one row. `name`, `address`, `time_zone` (IANA name, for example `America/New_York`), `currency` (`USD`). Zero rows means `LOT_SETUP_REQUIRED`. |
| `customers` | Fields in section 6.3. Active `usdot_number` unique: partial unique index `WHERE is_active = 1 AND usdot_number IS NOT NULL`. |
| `vehicles` | Fields in section 6.4, plus `plate_normalized` (uppercase letters and digits only). Partial unique indexes on active rows: (`plate_normalized`, `plate_jurisdiction`) and (`usdot_number`, `unit_number`). |
| `vehicle_parking` | One row per vehicle: `starts_on`, `ends_on` (exclusive, nullable). Monthly charge periods recur from `starts_on`; there are no customer defaults, capacity pools, or vehicle-type categories. |
| `vehicle_rates` | Append-only: `vehicle_id`, `effective_on`, `monthly_rate_cents`, `reason`, `created_by`. Unique (`vehicle_id`, `effective_on`). |
| `billing_runs` | `customer_id`, `through_date`, `status` (`preview`, `issued`), snapshot of the lines, the vehicle and rate versions used, credit available, and the financial "fingerprint" of the customer at preview time. |
| `invoices` | `invoice_number` (unique, assigned at issue), `customer_id`, customer snapshot, `status` (`draft`, `issued`, `void`), `issued_on`, `due_on`, `total_cents`, `source_type` (`monthly_parking`, `manual`, `opening_balance`). |
| `invoice_lines` | `invoice_id`, description, `amount_cents`, vehicle snapshot (unit, plate, jurisdiction, USDOT), `service_starts_on`, `service_ends_on`, `charge_type`, `rate_id`. Unique (`vehicle_id`, `service_period_start`, `charge_type`) across non-void invoices so a period can never be billed twice. |
| `payments` | `customer_id`, customer name snapshot, `amount_cents`, `effective_on`, `method`, `reference`, `notes`, `status` (`received`, `reversed`), `recorded_by`. |
| `payment_reversals` | `payment_id` (unique), `reason`, `actor_id`, `created_at`. |
| `payment_allocations` | `payment_id`, `invoice_id`, `amount_cents`, `created_by`, `released_at` (set when a reversal or credit releases it). |
| `opening_balances` | Migration adjustments with a cutoff date and source identifier (REQUIREMENTS 15.3). Never counted as cash collected. |
| `audit_events` | `actor_id`, `action`, `resource_type`, `resource_id`, `before`, `after`, `reason`, `request_id`, `created_at`. |
| `idempotency_records` | `actor_id`, `key`, `operation`, `request_hash`, `status_code`, `resource_type`, `resource_id`, `created_at`. Unique (`actor_id`, `key`). |

Derived values are calculated, not stored as editable columns: invoice remaining balance, paid/partially paid/unpaid, overdue, customer balances, and unapplied credit.

---

## 6. Endpoints the frontend already calls

These are the exact shapes in `src/features/**/types.ts`, `model.ts`, and `api.ts`. Building these first lets the app switch from mocks to the real backend.

Access: **Staff** means any signed-in operator or admin.

### 6.1 Summary table

| # | Method | Path | Access | Headers | Success |
| --- | --- | --- | --- | --- | --- |
| 1 | POST | `/auth/login` | Public | CSRF | 200 session body, sets cookie |
| 2 | GET | `/auth/session` | Signed in | | 200 session body |
| 3 | POST | `/auth/logout` | Signed in | CSRF | 204, clears cookie |
| 4 | GET | `/lots/current` | Staff | | 200 lot |
| 5 | GET | `/customers` | Staff | | 200 page of customers with balances |
| 6 | POST | `/customers` | Staff | CSRF | 201 customer |
| 7 | GET | `/customers/{id}` | Staff | | 200 customer |
| 8 | PATCH | `/customers/{id}` | Staff | CSRF, If-Match | 200 customer |
| 9 | GET | `/customers/{id}/ledger` | Staff | | 200 ledger |
| 10 | GET | `/vehicles` | Staff | | 200 page of vehicles |
| 11 | POST | `/vehicles` | Staff | CSRF | 201 vehicle |
| 12 | GET | `/vehicles/{id}` | Staff | | 200 vehicle |
| 13 | PATCH | `/vehicles/{id}` | Staff | CSRF, If-Match | 200 vehicle |
| 14 | POST | `/vehicles/{id}/parking` | Staff; admin for rate or end-date changes | CSRF, If-Match | 200 vehicle |
| 15 | POST | `/billing-runs/preview` | Staff | CSRF | 200 billing run |
| 16 | POST | `/billing-runs/{id}/issue` | Staff | CSRF, Idempotency-Key | 200 billing run |
| 17 | GET | `/invoices` | Staff | | 200 page of invoices |
| 18 | POST | `/invoices` | Staff | CSRF, Idempotency-Key | 201 draft invoice |
| 19 | POST | `/invoices/{id}/issue` | Staff | CSRF, Idempotency-Key | 200 issued invoice |
| 20 | GET | `/payments` | Staff | | 200 page of payments |
| 21 | GET | `/payments/{id}` | Staff | | 200 payment |
| 22 | POST | `/payments` | Staff | CSRF, Idempotency-Key | 201 payment |
| 23 | POST | `/payments/{id}/reverse` | Admin | CSRF, If-Match, Idempotency-Key | 200 payment |
| 24 | GET | `/reports/summary` | Staff | | 200 dashboard metrics |

### 6.2 Auth

`POST /auth/login` body: `{ "email": "...", "password": "..." }`. Trim and lowercase the email before lookup.

Login and `GET /auth/session` both return:

```json
{
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "name": "Admin",
    "role": "admin",
    "is_active": true,
    "preferred_language": "zh-CN",
    "must_change_password": false
  },
  "session": {
    "idle_expires_at": "2026-10-24T03:38:20Z",
    "absolute_expires_at": "2026-10-24T11:08:20Z"
  }
}
```

Errors: `401 INVALID_CREDENTIALS`, `403 ACCOUNT_INACTIVE`, `401 SESSION_EXPIRED`, `403 CSRF_REJECTED`, `429 RATE_LIMITED`.

### 6.3 Customers

Customer read shape:

```
id, version, type ("individual" | "business"), display_name, contact_name, phone, email,
usdot_number, address_line1, address_line2, city, state, postal_code, notes,
is_active, created_at, updated_at
```

`GET /customers` items add three calculated fields, computed in SQL for the whole page (no per-row queries):

- `net_balance`: outstanding issued invoices minus unapplied credit.
- `overdue_balance`: unpaid amount on issued invoices whose due date is before today. This is part of the outstanding amount, not extra.
- `truck_count`: active vehicles of type `truck` or `combination`. Trailers and compact cars are not counted.

Query parameters:

| Param | Rule |
| --- | --- |
| `q` | Case-insensitive match on display name, contact name, phone, email, and USDOT. If the search has 3 or more digits, also match digits-only phone and USDOT values. |
| `include_inactive` | `true` includes archived customers. Default is active only. |
| `overdue_only` | `true` returns only customers with `overdue_balance > 0`. Applied before paging. |
| `page`, `page_size` | Standard paging. |

Sort by `display_name`, then `id`. Chinese names should sort in a sensible order (see section 12, item 6).

Write fields for `POST` and `PATCH`: `type`, `display_name`, `contact_name`, `phone`, `email`, `usdot_number`, `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `notes`. `PATCH` also accepts `is_active`. Any other field, including the removed billing-day and payment-term defaults, is rejected.

Rules:

- Trim strings. Empty strings become `null`.
- `display_name` is required.
- `email` must look like an email address.
- `usdot_number` is stored as 1 to 8 digits only. Non-digits are rejected, not silently removed.
- An active customer's USDOT must be unique among active customers: `409 USDOT_ALREADY_IN_USE` with `field_errors.usdot_number`.
- There is no delete. Archive with `is_active: false`. Archived customers keep their balance and can still pay.

Errors: `404 CUSTOMER_NOT_FOUND`, `422 VALIDATION_FAILED`, `409 USDOT_ALREADY_IN_USE`, `428 IF_MATCH_REQUIRED`, `412 STALE_VERSION`.

### 6.4 Vehicles

Vehicle read shape:

```
id, version, customer_id, customer_name (read-only), vehicle_type ("truck" | "trailer" | "combination" | "compact"),
unit_number, plate_number, plate_jurisdiction, usdot_number, is_active, created_at, updated_at,
parking (null or the parking object in 6.5)
```

`GET /vehicles` parameters: `q`, `customer_id`, `include_inactive`, `page`, `page_size`. `q` matches unit number, plate (ignoring spaces, dashes, and case), USDOT, and customer name.

Write fields: `customer_id` (create only), `vehicle_type`, `unit_number`, `plate_number`, `plate_jurisdiction`, `usdot_number`. `PATCH` also accepts `is_active`. Changing the owner is a separate workflow, so `PATCH` rejects `customer_id`.

`POST /vehicles` also accepts optional `parking` using the write shape in section 6.5. The add-vehicle form sends it when a monthly amount (including zero) is entered, with an explicit billing start date, `ends_on: null`, and `effective_on` equal to `starts_on`. Validate the initial setup under the same rules as a first parking save, including an active customer, and create the vehicle and parking history in one transaction. Reject invalid parking with `422 INVALID_PARKING` without persisting a vehicle. Omitting `parking` preserves vehicle-only creation. This create payload extension is implemented in the frontend and mocks; real backend support remains unverified.

Rules (REQUIREMENTS 7.1):

- A plate needs its jurisdiction and the other way round (`field_errors` code `REQUIRED`).
- A vehicle needs a plate with jurisdiction, a USDOT number, or both (`IDENTIFIER_REQUIRED`).
- A vehicle with USDOT but no plate needs a unit number (`REQUIRED` on `unit_number`).
- USDOT is digits only (`INVALID_USDOT`).
- Keep the plate as typed for display; match on the normalized value.
- Duplicate active plate and jurisdiction: `409 PLATE_ALREADY_IN_USE`. Duplicate active USDOT and unit number: `409 UNIT_NUMBER_ALREADY_IN_USE`.
- Archiving a vehicle whose monthly parking has not ended: `409 PARKING_STILL_ACTIVE`.
- A new vehicle may default to its customer's USDOT number in the UI; the backend just stores what is sent.

Errors: `404 VEHICLE_NOT_FOUND`, `422 VALIDATION_FAILED`, the 409 codes above, `428 IF_MATCH_REQUIRED`, `412 STALE_VERSION`.

### 6.5 Monthly parking

`GET /lots/current` returns `{ "id", "name", "time_zone", "currency": "USD" }`. If the lot is not set up: `503 LOT_SETUP_REQUIRED`.

`POST /vehicles/{id}/parking` with `If-Match` saves the vehicle's monthly parking:

```json
{
  "starts_on": "2026-11-01",
  "ends_on": null,
  "monthly_rate": { "amount": 30000, "currency": "USD" },
  "effective_on": "2026-11-01",
  "reason": "New monthly customer"
}
```

It returns the whole vehicle with `parking` filled in:

```json
"parking": {
  "starts_on": "2026-11-01",
  "ends_on": null,
  "monthly_rate": { "amount": 30000, "currency": "USD" },
  "rate_history": [
    { "effective_on": "2026-11-01", "monthly_rate": { "amount": 30000, "currency": "USD" }, "reason": "New monthly customer" }
  ]
}
```

`monthly_rate` is the rate in effect today (or the first rate if service has not started yet). Future rates appear in `rate_history` but do not change `monthly_rate` until their date.

Rules (REQUIREMENTS 7.2):

| Case | Rule | Error |
| --- | --- | --- |
| Bad body | Dates valid, `ends_on` after `starts_on`, positive rate, `reason` 1 to 1000 characters | `422 VALIDATION_FAILED` |
| First save | `effective_on` must equal `starts_on`. Billing periods start on `starts_on` and recur monthly on that day; clamp to month-end where necessary, then restore the original day when possible. The first period is a full month from the start date. | `422 INVALID_EFFECTIVE_DATE` |
| First save | Vehicle and customer must be active | `409 INVALID_PARKING` |
| Existing setup | `starts_on` cannot change | `409 SERVICE_HISTORY_IMMUTABLE` |
| Existing setup | Changing the rate or `ends_on` needs an admin | `403 ADMIN_REQUIRED` |
| Rate change | `effective_on` must be after today and after the latest scheduled rate. Append a new rate row; never edit old ones. | `409 INVALID_EFFECTIVE_DATE` |
| No rate change | `effective_on` must equal the latest rate's date | `409 INVALID_EFFECTIVE_DATE` |

Saving parking never creates debt. Charges only become debt when a billing run is issued.

### 6.6 Ledger and balances

`GET /customers/{id}/ledger`:

```json
{
  "as_of": "2026-10-24T03:08:20Z",
  "outstanding": { "amount": 15000, "currency": "USD" },
  "overdue": { "amount": 5000, "currency": "USD" },
  "unapplied_credit": { "amount": 0, "currency": "USD" },
  "net_balance": { "amount": 15000, "currency": "USD" },
  "monthly_parking": { "amount": 45000, "currency": "USD" },
  "unbilled_parking": { "amount": 0, "currency": "USD" },
  "last_payment": { "id": "uuid", "amount": { "amount": 30000, "currency": "USD" }, "effective_on": "2026-10-01", "method": "bank_transfer" }
}
```

Definitions (one shared function used by the ledger, customer list, and dashboard):

| Field | Definition |
| --- | --- |
| `outstanding` | Sum of remaining balances on issued, non-void invoices. Remaining = total minus active allocations minus credit notes, never below 0. |
| `overdue` | The part of `outstanding` on invoices whose `due_on` is before today. Due today is not overdue. |
| `unapplied_credit` | Valid received payments minus their active allocations, plus opening credit. |
| `net_balance` | `outstanding - unapplied_credit`. Positive means the customer owes money. |
| `monthly_parking` | Sum of current monthly rates for the customer's vehicles whose service covers today. Information only. |
| `unbilled_parking` | What a billing run through today would charge for periods not yet billed. Information only, not debt. |
| `last_payment` | Latest non-reversed payment by `effective_on`, then `created_at`, then `id`. Opening credit is not a payment. `null` if none. |

### 6.7 Billing runs (monthly charges)

`POST /billing-runs/preview` body: `{ "customer_id": "uuid", "through_date": "2026-11-30" }`. `through_date` cannot be after today (`422 INVALID_BILLING_RANGE`).

It saves a preview and returns:

```json
{
  "id": "uuid",
  "customer_id": "uuid",
  "through_date": "2026-11-30",
  "lines": [
    {
      "key": "vehicle-uuid:2026-11-01:2026-12-01",
      "vehicle_id": "uuid",
      "vehicle_label": "Unit 12",
      "starts_on": "2026-11-01",
      "ends_on": "2026-12-01",
      "service_days": 30,
      "period_days": 30,
      "amount": { "amount": 30000, "currency": "USD" }
    }
  ],
  "total": { "amount": 30000, "currency": "USD" },
  "credit_available": { "amount": 0, "currency": "USD" },
  "amount_due_after_credit": { "amount": 30000, "currency": "USD" },
  "already_billed_count": 0,
  "status": "preview",
  "invoice_numbers": []
}
```

`vehicle_label` is the unit number, else the plate, else the USDOT number.

**Billing period math** (REQUIREMENTS 7.3). The mock in `src/mocks/monthlyCharges.ts` implements this and its tests are a good starting point.

1. Periods start on the anchor day each month. If the month is too short, use its last day. Always compute from the original anchor so February does not shift later months.
2. Billing is in advance. A period is included when its service start is on or before `through_date`.
3. The service part of a period is from the later of period start and `starts_on` to the earlier of period end and `ends_on`.
4. Split the service part at any rate change date inside it. For each piece: `rate_cents * days_in_piece`.
5. Line amount = sum of pieces / days in the full period, rounded half-up to the cent. Round once per line, not per piece.
6. Skip periods already billed on a non-void invoice and count them in `already_billed_count`.

Example: $300.00 per month, 15 of 30 days = $150.00.

`POST /billing-runs/{id}/issue` body: `{ "apply_credit": true }`, with `Idempotency-Key`.

In one transaction it:

1. Confirms nothing used by the preview has changed (vehicle versions, rate versions, the customer's balances and credit). Otherwise `412 BILLING_PREVIEW_STALE`.
2. Creates issued invoices with numbers and snapshots. Lines with the same due date share one invoice.
3. If `apply_credit` is true, allocates available credit to the new invoices, oldest due first. This does not create a new payment.
4. Marks the run `issued` and fills `invoice_numbers`.

A period that was billed in the meantime: `409 VEHICLE_PERIOD_ALREADY_BILLED`. Retrying with the same key returns the same run.

**Invoice due date:** start of the service period, or the issue date if issued later (REQUIREMENTS 1.2). Customer and parking records have no payment-term override.

**Invoice numbers:** unique, human-readable, never reused, assigned only at issue. Suggested format `INV-2026-000123`. Gaps after a failed transaction are acceptable; duplicates are not.

### 6.8 Manual charges (one-time invoices)

`POST /invoices` with `Idempotency-Key` creates a draft:

```json
{ "customer_id": "uuid", "due_on": "2026-11-15", "description": "Gate repair", "amount": { "amount": 5000, "currency": "USD" } }
```

Returns `201` with `{ ...body, "id", "version", "invoice_number": null, "issued_on": null, "status": "draft" }`. Description is 1 to 200 characters.

`POST /invoices/{id}/issue` with `Idempotency-Key` issues the draft and returns it with `invoice_number`, `issued_on`, and `status: "issued"`. Already issued with a different key: `409 ALREADY_ISSUED`. Drafts never count toward balances.

`GET /invoices` parameters: `customer_id` (required for now, `422 CUSTOMER_REQUIRED`), `source_type` (`manual`, later others), `q` (description or invoice number), `from` and `to` (issue date, inclusive), `page`, `page_size`. The customer history only shows issued invoices.

### 6.9 Payments

Payment read shape:

```
id, version, customer_id, customer_name, amount, allocated_amount, available_credit,
effective_on, method, reference, notes, status ("received" | "reversed"),
recorded_by: { id, name }, created_at,
reversal: null | { reason, actor: { id, name }, created_at },
audit_events: [{ action ("recorded" | "reversed" | "allocated"), actor_id, reason, created_at }]
```

`GET /payments` parameters: `customer_id`, `q` (customer name or reference), `from` and `to` (effective date, inclusive), `method`, `status`, `page`, `page_size`. Bad filters: `422 INVALID_FILTERS`. Sort newest first by `effective_on`, then `created_at`, then `id`.

`POST /payments` with `Idempotency-Key`:

```json
{
  "customer_id": "uuid",
  "amount": { "amount": 30000, "currency": "USD" },
  "effective_on": "2026-10-01",
  "method": "bank_transfer",
  "reference": "Wire 1234",
  "notes": null
}
```

- Methods: `cash`, `check`, `bank_transfer`, `external_card`, `other`.
- `effective_on` cannot be in the future in the lot time zone.
- `reference` at most 200 characters, `notes` at most 2000.
- Archived customers can still pay.
- A new payment starts as unapplied credit. It is applied when staff issue charges with `apply_credit`, or later through `POST /payments/{id}/allocate`.
- This only records money already received. It never charges a card.

`POST /payments/{id}/reverse` (admin, `If-Match`, `Idempotency-Key`), body `{ "reason": "Entered twice" }`:

- Reason is 1 to 1000 characters (`422 REASON_REQUIRED`).
- Already reversed: `409 PAYMENT_ALREADY_REVERSED`.
- In one transaction: mark reversed, release all of its allocations (those invoices become unpaid again), write audit events, and update balances.
- A reversal fixes a wrong record. It is not a refund.

There is no edit or delete for payments.

### 6.10 Dashboard

`GET /reports/summary`:

```json
{
  "outstanding_invoices": { "amount": 15000, "currency": "USD" },
  "overdue_invoices": { "amount": 5000, "currency": "USD" },
  "unbilled_parking": { "amount": 0, "currency": "USD" },
  "payments_received_this_month": { "amount": 30000, "currency": "USD" },
  "total_customers": 5,
  "total_trucks": 6
}
```

- `outstanding_invoices` and `overdue_invoices` are the sums of the ledger values over all customers, including archived ones. Overdue is part of outstanding; the overview page shows "not due yet" as the difference.
- `payments_received_this_month`: non-reversed payments with `effective_on` from the 1st of the current month through today.
- `total_customers` counts all customers including archived ones. `total_trucks` counts trucks and combinations, not trailers or compact cars.

---

## 7. Endpoints still needed for MVP 1

These are in REQUIREMENTS 11 but the frontend does not call them yet. Build them as the matching screens are built. Each follows the conventions above.

| Area | Endpoints |
| --- | --- |
| Session and profile | `POST /auth/activity`, `POST /auth/change-password`, `PATCH /users/me` |
| Staff admin | `GET/POST /admin/users`, `PATCH /admin/users/{id}`, `POST /admin/users/{id}/reset-password` |
| Lot | `PATCH /lots/{id}` |
| Billing | `GET /billing-runs/{id}`, `GET/PATCH /invoices/{id}`, `POST /invoices/{id}/void`, `GET /invoices/{id}/pdf`, `POST /invoices/{id}/credit-notes` |
| Payments | `POST /payments/{id}/allocate`, `POST /payments/{id}/refunds` |
| Statements | `GET /customers/{id}/statement.pdf` |
| Reports | `GET /reports/collections`, `GET /reports/receivables` (with aging buckets 1-30, 31-60, 61-90, over 90 days) |
| Data | `GET /exports/{dataset}`, `POST /imports/validate`, `GET /imports/{id}`, `POST /imports/{id}/commit` |
| Audit | `GET /audit-events` |

The existing-data import (REQUIREMENTS 15) is part of MVP 1 and needs its own short design before it is built: dry run, reconciliation report, source IDs, and safe repeat.

---

## 8. Audit

**BE-30** Write an audit event, in the same transaction as the change, for:

- Login, logout, failed login, password change and reset, and user role or status changes.
- Creating, editing, or archiving customers and vehicles, with before and after values.
- Saving parking setups and every rate change, with the reason.
- Issuing billing runs and invoices, voids, and credit notes.
- Recording, allocating, and reversing payments, with the reason.
- Imports.

Audit events are never edited or deleted.

---

## 9. Running the service

**BE-40 Configuration** (environment variables, loaded once at startup):

| Variable | Example | Notes |
| --- | --- | --- |
| `OCEANLINK_ENV` | `production` | `development`, `test`, or `production`. |
| `DATABASE_PATH` | `/var/lib/oceanlink/oceanlink.db` | Outside the release folder. |
| `ALLOWED_ORIGINS` | `https://app.example.com` | For the `Origin` check. Exact matches only. |
| `SESSION_COOKIE_NAME` | `__Host-session_id` | Development may use `session_id`. |
| `SESSION_COOKIE_SECURE` | `true` | Must be `true` in production. |
| `LOG_LEVEL` | `INFO` | |

Startup fails in production if the cookie is not secure, the cookie name is not `__Host-session_id`, or `ALLOWED_ORIGINS` is empty or contains `*`.

**BE-41 SQLite settings**

- On every connection: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL` (or `FULL` if the owners prefer extra safety).
- Writes that check then change (billing, payments, idempotency) use `BEGIN IMMEDIATE` so they run one at a time.
- If the database is busy after retries, return `503` with `code: "TEMPORARILY_UNAVAILABLE"` and `Retry-After`. Never return a half-done write.
- Run one Uvicorn worker to start. More workers are allowed later on the same host only.

**BE-42 Health checks**

- `GET /api/v1/health/live`: process is up. No auth, no database.
- `GET /api/v1/health/ready`: database reachable, migrations current, lot configured. Returns the app version. No customer data.

**BE-43 Backups and releases** follow [DEPLOYMENT.md](DEPLOYMENT.md) sections 11 and 12. The backend provides a CLI backup command that uses the SQLite backup API and records the timestamp, checksum, app version, and schema version.

**BE-44 Local development**

- `uvicorn app.main:app --reload --port 8000`. The Vite dev server proxies `/api` to it, so no CORS is needed.
- A seed command creates a lot and the two synthetic staff accounts used by the mocks. Never seed real customer data.
- To test from a phone on the same Wi-Fi, run Vite with `--host` and add that origin to `ALLOWED_ORIGINS` for development.

---

## 10. Testing and acceptance

**BE-50 Required automated tests**

- **Contract tests:** each endpoint in section 6 returns exactly the documented fields and types. Keep the OpenAPI schema stable so the frontend can generate its client from it.
- **The financial example** (REQUIREMENTS 17.1): two monthly charges of $200 and $250 issue a $450 invoice; a $300 payment leaves $150 due; an authorized $100 credit leaves $50.
- **Proration table:** anchor days 1, 15, 29, 30, and 31 across February, leap years, 30-day and 31-day months, mid-period starts and ends, and a rate change inside a period. Cross-check against `src/mocks/monthlyCharges.ts`.
- **Ledger:** outstanding, overdue, credit, and net balance after payments, partial payments, overpayments, reversals, and credit application. Overdue is never more than outstanding. Due today is not overdue.
- **Idempotency:** same key returns the same result; same key with a different body returns `409`; two parallel identical requests create one record.
- **Concurrency:** two parallel parking saves for the last space; only one succeeds.
- **Stale versions:** every `If-Match` route returns `428` and `412` correctly.
- **Security:** every write without the CSRF header or from a wrong origin returns `403`; every route without a session returns `401`; operator calls to admin routes return `403`; expired sessions fail; deactivated users are signed out.
- **Errors:** Pydantic validation errors come back in the documented error shape.

**BE-51 Done for MVP 1 backend**

- All section 6 endpoints pass the tests above.
- The frontend runs against the real backend with mocks off, in both languages, and its existing test scenarios behave the same.
- No route is missing a role check.
- A backup has been restored in a test environment and balances match.
- REQUIREMENTS 17.1 acceptance criteria that depend on the backend are met.

---

## 11. Out of scope for this backend phase

Physical check-in and occupancy (MVP 2), driver accounts, reservations, and online payment (MVP 3), and everything listed in REQUIREMENTS 18 (multiple lots, automatic late fees, automatic card charging, WebSockets, general ledger accounting, and so on).

---

## 12. Open decisions

Decide these before or during the first backend sprint.

| # | Question | Why it matters | Suggestion |
| --- | --- | --- | --- |
| 1 | Development cookie name and HTTPS (README, REVIEW item 3.3). | `__Host-` cookies need HTTPS. | Use the configurable cookie name in BE-40 for development. |
| 2 | Missing `If-Match` returns `428` in the mocks, but `428` is not in REQUIREMENTS 12.3. | The frontend may treat it as a generic error. | Add `428 IF_MATCH_REQUIRED` to REQUIREMENTS 12.3. |
| 3 | The mocks use specific `422` codes (`INVALID_PAYMENT`, `INVALID_PARKING`, `INVALID_BILLING_RANGE`) without `field_errors`. | Forms cannot highlight the bad field. | Use `VALIDATION_FAILED` with `field_errors` for field problems. Keep the specific codes for rules that are not tied to one field. Confirm the frontend handles both. |
| 4 | Billing run issue is all or nothing here, but REQUIREMENTS 11.4 mentions per-invoice outcomes. | With one customer per run, partial success adds complexity for little value. | Keep all or nothing for MVP 1. Revisit if runs cover many customers. |
| 5 | Sorting Chinese names in SQLite. | SQLite does not sort Chinese by pinyin. | Store a `sort_key` (pinyin for Chinese, lowercase for English) when a customer is saved. |
| 6 | Some mock read routes (ledger, lists) do not check the session. | The real backend must. | Every route except login and health requires a session. |
| 7 | Overdue as-of time. | "Before today" changes at midnight in the lot's time zone. | Confirm that midnight lot time is the right cut-off with the owners. |
