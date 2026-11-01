# OceanLink API: Build Spec (Python FastAPI + SQLite)

**Version:** 1.1 (2026-10-31, owner-approved automatic payment allocation)
**For:** the person or coding agent building the `oceanlink-api` backend.
**Goal:** a backend the rebuilt frontend (see [UX_REBUILD.md](UX_REBUILD.md)) can switch to by setting `VITE_ENABLE_MOCKS=false`, with no frontend code changes.

This file is self-contained. You can build the backend from it alone. It is derived from:

| Source | What it contributed |
| --- | --- |
| Frontend `src/features/*/types.ts` and `api.ts` | Exact request and response shapes, headers, query parameters |
| Frontend `src/mocks/` (MSW handlers, `db.ts`, `monthlyCharges.ts`) | Executable reference behavior the UI was tested against |
| [BACKEND_REQUIREMENTS.md](BACKEND_REQUIREMENTS.md) | Conventions, data model, security rules (`BE-xx` IDs) |
| [BACKEND_LOGIC_CHANGES.md](BACKEND_LOGIC_CHANGES.md) | Contract details added by the 2026-10-31 rebuild |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Business rules and acceptance criteria |

When this file disagrees with REQUIREMENTS.md on a business rule, REQUIREMENTS.md wins. When it disagrees with the frontend code on a wire shape, the frontend code wins. Report either case in section 12 instead of guessing.

Writing rule for code, comments, and docs in the backend repo: no em dashes.

---

## 0. Contents

1. Scope
2. Stack and project layout
3. Configuration and running
4. Cross-cutting rules (paths, money, dates, errors, versions, idempotency, CSRF, sessions, roles)
5. Database schema (SQLite DDL)
6. Shared domain logic (ledger, monthly charges, search)
7. Endpoint reference
8. Audit events
9. Development seed data
10. Tests and golden cases
11. Build phases
12. Open decisions
13. Prompt for a coding agent

---

## 1. Scope

### 1.1 Build now (the frontend calls these)

| # | Method | Path | Access | Required headers |
| --- | --- | --- | --- | --- |
| 1 | POST | `/auth/login` | Public | CSRF |
| 2 | GET | `/auth/session` | Signed in | |
| 3 | POST | `/auth/activity` | Signed in | CSRF |
| 4 | POST | `/auth/logout` | Public (no session needed) | CSRF |
| 5 | GET | `/lots/current` | Staff | |
| 6 | GET | `/customers` | Staff | |
| 7 | POST | `/customers` | Staff | CSRF |
| 8 | GET | `/customers/{id}` | Staff | |
| 9 | PATCH | `/customers/{id}` | Staff | CSRF, If-Match |
| 10 | GET | `/customers/{id}/ledger` | Staff | |
| 11 | GET | `/vehicles` | Staff | |
| 12 | POST | `/vehicles` | Staff | CSRF |
| 13 | GET | `/vehicles/{id}` | Staff | |
| 14 | PATCH | `/vehicles/{id}` | Staff | CSRF, If-Match |
| 15 | POST | `/vehicles/{id}/parking` | Staff; admin for rate or end-date changes | CSRF, If-Match |
| 16 | POST | `/billing-runs/preview` | Staff | CSRF |
| 17 | POST | `/billing-runs/{id}/issue` | Staff | CSRF, Idempotency-Key |
| 18 | GET | `/invoices` | Staff | |
| 19 | POST | `/invoices` | Staff | CSRF, Idempotency-Key |
| 20 | POST | `/invoices/{id}/issue` | Staff | CSRF, Idempotency-Key |
| 21 | GET | `/payments` | Staff | |
| 22 | GET | `/payments/{id}` | Staff | |
| 23 | POST | `/payments` | Staff | CSRF, Idempotency-Key |
| 24 | POST | `/payments/{id}/reverse` | Admin | CSRF, If-Match, Idempotency-Key |
| 25 | GET | `/reports/summary` | Staff | |
| 26 | GET | `/health/live` | Public | |
| 27 | GET | `/health/ready` | Public | |

"Staff" means any signed-in, active `operator` or `admin`. All paths are under `/api/v1`.

### 1.2 Build later (frontend shows a placeholder page today)

Do not build these in the first pass. They are listed so the schema leaves room for them.

| Frontend page | Endpoints it waits for |
| --- | --- |
| `/profile` | `POST /auth/change-password`, `PATCH /users/me` |
| `/settings` | `GET/POST /admin/users`, `PATCH /admin/users/{id}`, `POST /admin/users/{id}/reset-password`, `PATCH /lots/{id}` |
| `/invoices` | `GET /invoices` without `customer_id`, `GET/PATCH /invoices/{id}`, `POST /invoices/{id}/void`, `GET /invoices/{id}/pdf`, credit notes |
| `/reports` | `GET /reports/collections`, `GET /reports/receivables` |
| (none yet) | `POST /payments/{id}/allocate`, refunds, statements, imports, exports, `GET /audit-events` |

### 1.3 Never in this backend

Driver accounts, public booking, online payment, check-in/out, live occupancy, multiple lots, queues, caches, message brokers, WebSockets, CORS in production.

---

## 2. Stack and project layout

| Area | Choice |
| --- | --- |
| Python | 3.12 (pin exact version in `.python-version`) |
| Framework | FastAPI, sync `def` route handlers (SQLite work is blocking; FastAPI runs them in a thread pool) |
| Validation | Pydantic v2. Write models use `model_config = ConfigDict(extra="forbid")` |
| Database | SQLite 3.35+ in WAL mode, one file |
| Data access | SQLAlchemy 2.0 (Core or ORM, typed). Explicit transactions |
| Migrations | Alembic |
| Passwords | Argon2id via `argon2-cffi` |
| Time zones | `zoneinfo` (stdlib). Add `tzdata` on Windows |
| Server | Uvicorn, one worker, behind Caddy or nginx in production |
| Tooling | `uv` for locked deps, `pytest` + `httpx` (FastAPI `TestClient`), `ruff`, `mypy --strict` or `pyright` strict |

No other runtime dependencies without approval. Optional (see section 12): `pypinyin` for Chinese name sorting.

```
oceanlink-api/
  app/
    main.py              create_app(): middleware, exception handlers, routers
    config.py            Settings (pydantic-settings or plain os.environ)
    clock.py             Clock dependency: now_utc(), today(lot_tz). Tests override it
    db.py                engine, PRAGMAs, BEGIN IMMEDIATE for writes, session dependency
    errors.py            ApiError, error codes, handlers for HTTPException and RequestValidationError
    security/            sessions, csrf, roles (dependencies), passwords, rate limit
    idempotency.py       run_idempotent(...)
    audit.py             write_audit(...)
    lots/
    customers/           router.py, schemas.py, service.py
    vehicles/            includes monthly parking
    billing/             billing runs, invoices, periods.py (monthly charge math)
    payments/
    ledger/              balances.py: the ONE place balances are calculated
    reports/
    cli.py               create-admin, reset-admin-password, seed-dev, backup
  migrations/
  tests/
```

Every money and balance number shown in the UI must come from `ledger/balances.py` so the customer page, customer list, and dashboard always agree.

---

## 3. Configuration and running

Environment variables, read once at startup:

| Variable | Dev default | Production | Notes |
| --- | --- | --- | --- |
| `OCEANLINK_ENV` | `development` | `production` | `development`, `test`, `production` |
| `DATABASE_PATH` | `./var/oceanlink.db` | `/var/lib/oceanlink/oceanlink.db` | Outside the release folder |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | `https://app.example.com` | Comma separated, exact match |
| `SESSION_COOKIE_NAME` | `oceanlink_session` | `__Host-session_id` | |
| `SESSION_COOKIE_SECURE` | `false` | `true` | |
| `SESSION_IDLE_MINUTES` | `30` | `30` | |
| `SESSION_ABSOLUTE_HOURS` | `8` | `8` | |
| `LOG_LEVEL` | `INFO` | `INFO` | |
| `ENABLE_DOCS` | `true` | `false` | `/docs` and `/openapi.json`. Keep `/openapi.json` available in dev for type generation |

Startup must fail in production if: cookie is not secure, cookie name is not `__Host-session_id`, `ALLOWED_ORIGINS` is empty or contains `*`.

Local development:

```
uv run alembic upgrade head
uv run python -m app.cli seed-dev          # lot, staff, demo customers (section 9)
uv run uvicorn app.main:app --reload --port 8000
```

The frontend's Vite dev server proxies `/api` to `http://localhost:8000` with `changeOrigin: false`, so the browser sees one origin and sends `Origin: http://localhost:5173`. No CORS needed. Run the frontend with `VITE_ENABLE_MOCKS=false`.

CLI commands (`python -m app.cli ...`):

| Command | Behavior |
| --- | --- |
| `create-admin --email --name` | Prompts for the password (never an argument). Writes an audit event |
| `reset-admin-password --email` | Recovery when all admins are locked out. Ends that user's sessions. Audit event |
| `create-lot --name --time-zone` | Creates the single lot row if none exists |
| `seed-dev` | Refuses to run when `OCEANLINK_ENV=production`. Loads section 9 data |
| `backup --out` | SQLite backup API. Prints timestamp, SHA-256, app version, schema version |

---

## 4. Cross-cutting rules

### 4.1 Format

- Base path `/api/v1`. JSON in and out. `snake_case` fields.
- IDs are UUID strings (v4 or v7). Never expose integer row IDs.
- Instants: UTC ISO 8601 with `Z`, for example `2026-10-24T03:08:20Z`.
- Business dates: `YYYY-MM-DD`, a calendar day in the lot's time zone.
- **"Today" always means today in the lot's `time_zone`**, from the `Clock` dependency. Never `date.today()`.
- Every documented field is always present. A missing value is `null`, never omitted. Set `response_model_exclude_none=False` (the default) and do not use `exclude_unset` on responses.
- Response models must match section 7 exactly so the frontend can later generate types from `/openapi.json`.

### 4.2 Money

- Wire shape: `{ "amount": <integer cents>, "currency": "USD" }`. Only `USD` is accepted.
- Store integer cents (`*_cents INTEGER`). Never floats. Use `int` or `Decimal` for math and round half up once per result.
- Amounts staff enter: integer, `1..999_999_999` (payments, one-time charges). Monthly rates allow `0` (free parking): `0..999_999_999`.
- Reject booleans and floats for `amount` (Pydantic `StrictInt`).

### 4.3 Lists and paging

- Query parameters `page` (default 1) and `page_size` (default 20, max 100). Out-of-range or non-numeric values are clamped like the mocks: invalid `page` becomes 1, invalid `page_size` becomes 20, values over 100 become 100.
- Response: `{ "items": [...], "page": 1, "page_size": 20, "total": 57 }`. `total` counts filtered rows before paging.
- Boolean query flags (`include_inactive`, `overdue_only`) are true only when the value is exactly `true`. The frontend omits false flags.
- Sorting is deterministic and always ends with `id`.
- The frontend asks for `page_size=100` on the Overview and customer pages. Keep the max at 100.

### 4.4 Error shape

Every non-2xx response, including 404 for unknown routes, 405, and framework errors:

```json
{
  "code": "USDOT_ALREADY_IN_USE",
  "message": "Another active customer has this USDOT number",
  "request_id": "01JB8K9V5Q2X7E3M4N6P8R0T1W",
  "field_errors": { "usdot_number": ["USDOT_ALREADY_IN_USE"] },
  "details": {}
}
```

- `code` is stable `UPPER_SNAKE_CASE`. The frontend reacts only to `code` and HTTP status.
- `message` is safe English with no customer data.
- `field_errors` maps a request field name to a list of codes (never sentences). Use `{}` when there are none.
- Every response (success or error) has an `X-Request-ID` header equal to `request_id`.
- Pydantic `RequestValidationError` becomes `422 VALIDATION_FAILED`. Map each error to the top-level body field name (the first `loc` item after `"body"`; for query errors use the parameter name) and a code:

| Pydantic error type | Field code |
| --- | --- |
| `missing` | `REQUIRED` |
| `extra_forbidden` | `NOT_ALLOWED` |
| `string_too_long` | `TOO_LONG` |
| anything else | `INVALID` |

  Exception: errors under `parking` in `POST /vehicles` become `422 INVALID_PARKING` (section 7.4).
- Unhandled exceptions: `500 INTERNAL_ERROR`, no stack trace, logged with `request_id`.

**Field codes the frontend translates** (others show a generic "check this field"):

| Form | Codes with specific messages |
| --- | --- |
| Customer | `REQUIRED`, `INVALID_EMAIL`, `INVALID_USDOT`, `USDOT_ALREADY_IN_USE` |
| Vehicle | `REQUIRED`, `IDENTIFIER_REQUIRED`, `INVALID_USDOT`, `PLATE_ALREADY_IN_USE`, `UNIT_NUMBER_ALREADY_IN_USE` |

### 4.5 Error code catalog

| Status | Code | When |
| --- | --- | --- |
| 400 | `IDEMPOTENCY_REQUIRED` | `Idempotency-Key` missing, empty, or over 200 characters |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password (same message and similar timing for both) |
| 401 | `SESSION_EXPIRED` | No cookie, unknown, revoked, idle-expired, or absolute-expired session; user deactivated |
| 403 | `CSRF_REJECTED` | Write failed the CSRF checks in 4.8 |
| 403 | `ACCOUNT_INACTIVE` | Login for a deactivated user |
| 403 | `ADMIN_REQUIRED` | Operator called an admin-only action |
| 403 | `PASSWORD_CHANGE_REQUIRED` | User has `must_change_password` and called a blocked route (4.10) |
| 404 | `NOT_FOUND` | Unknown route |
| 404 | `CUSTOMER_NOT_FOUND`, `VEHICLE_NOT_FOUND`, `INVOICE_NOT_FOUND`, `PAYMENT_NOT_FOUND`, `BILLING_RUN_NOT_FOUND` | Unknown ID (also for malformed UUIDs in the path) |
| 405 | `METHOD_NOT_ALLOWED` | Wrong HTTP method |
| 409 | `IDEMPOTENCY_CONFLICT` | Same key reused with different content |
| 409 | `USDOT_ALREADY_IN_USE` | Active customer USDOT clash. `field_errors.usdot_number` |
| 409 | `PLATE_ALREADY_IN_USE` | Active vehicle plate + jurisdiction clash. `field_errors.plate_number` |
| 409 | `UNIT_NUMBER_ALREADY_IN_USE` | Active vehicle USDOT + unit clash. `field_errors.unit_number` |
| 409 | `PARKING_STILL_ACTIVE` | Deactivating a vehicle whose parking has not ended |
| 409 | `INVALID_PARKING` | First parking save on an inactive vehicle or customer |
| 409 | `SERVICE_HISTORY_IMMUTABLE` | Changing `starts_on` of existing parking |
| 409 | `INVALID_EFFECTIVE_DATE` | Rate change date not in the future or not after the latest rate; or no rate change but `effective_on` differs from latest |
| 409 | `VEHICLE_PERIOD_ALREADY_BILLED` | Issue found a line already billed, or the run has no lines |
| 409 | `ALREADY_ISSUED` | Issuing a run or invoice that is not in preview/draft state (with a new key) |
| 409 | `PAYMENT_ALREADY_REVERSED` | Reversing a reversed payment |
| 412 | `STALE_VERSION` | `If-Match` does not equal the current `version` |
| 412 | `BILLING_PREVIEW_STALE` | Something the preview depended on changed (6.4) |
| 422 | `VALIDATION_FAILED` | Field validation. Always with `field_errors` |
| 422 | `INVALID_PARKING` | Bad `parking` object in `POST /vehicles` (nothing saved) |
| 422 | `INVALID_EFFECTIVE_DATE` | First parking save where `effective_on != starts_on` |
| 422 | `INVALID_BILLING_RANGE` | `through_date` invalid or after today |
| 422 | `CUSTOMER_REQUIRED` | `GET /invoices` without `customer_id` |
| 422 | `INVALID_FILTERS` | Bad `GET /payments` filter (4.3 clamping still applies to paging) |
| 422 | `REASON_REQUIRED` | Reversal reason empty or over 1000 characters |
| 428 | `IF_MATCH_REQUIRED` | `If-Match` missing on a route that needs it |
| 429 | `RATE_LIMITED` | Too many failed logins. Send `Retry-After` (seconds) |
| 500 | `INTERNAL_ERROR` | Unhandled error |
| 503 | `LOT_SETUP_REQUIRED` | No lot row exists |
| 503 | `TEMPORARILY_UNAVAILABLE` | SQLite still busy after `busy_timeout`. Send `Retry-After`. Never leave a half-done write |
| 503 | `NOT_READY` | `GET /health/ready` only: database, migrations, or lot not ready |

**Check order** for every route: (1) CSRF for writes, (2) session, (3) `must_change_password` block, (4) role, (5) lot exists, (6) `Idempotency-Key` present and replay lookup, (7) resource exists, (8) `If-Match`, (9) body validation, (10) business rules. Pydantic body parsing may run before steps 7 and 8; that is acceptable.

The frontend treats any 5xx or network failure on a money write as an **unknown outcome** and retries with the same key and body. Your idempotency replay (4.7) is what makes that safe.

### 4.6 Versions and `If-Match`

- Mutable records (`customers`, `vehicles`, `invoices`, `payments`) have `version INTEGER NOT NULL DEFAULT 1`. Every successful change adds 1.
- The frontend sends `If-Match: "3"` (quoted integer). Strip quotes; also accept an unquoted integer and a `W/` prefix.
- Missing: `428 IF_MATCH_REQUIRED`. Unparseable or different: `412 STALE_VERSION`.
- Check and update in the same transaction: `UPDATE ... SET version = version + 1 WHERE id = :id AND version = :expected`. Zero rows updated means `412`.
- Things that bump a version:
  - Customer: any PATCH.
  - Vehicle: any PATCH and any parking save (parking lives on the vehicle's version).
  - Payment: being allocated to an invoice (automatically on recording or when credit is applied during billing) and being reversed. The receipt dialog reverses with the payment's current `version`, so allocations must bump it.
  - Invoice: issue.

### 4.7 Idempotency

Required on: `POST /payments`, `POST /payments/{id}/reverse`, `POST /invoices`, `POST /invoices/{id}/issue`, `POST /billing-runs/{id}/issue`.

- Header `Idempotency-Key`, 1 to 200 characters, else `400 IDEMPOTENCY_REQUIRED`.
- Record key: unique (`actor_id`, `key`).
- `request_hash` = SHA-256 of canonical JSON: `{ "operation": "<name>", "path": {<path params>}, "if_match": <raw header or null>, "body": <parsed body, keys sorted> }`. Operation names: `payment.record`, `payment.reverse`, `invoice.create`, `invoice.issue`, `billing_run.issue`.
- Lookup before running:
  - Found, same hash: return the stored `status_code` and the **current** representation of the stored resource (`resource_type`, `resource_id`). Do not run again.
  - Found, different hash: `409 IDEMPOTENCY_CONFLICT`.
  - Not found: run the operation.
- Only successful (2xx) outcomes are stored. Definite errors (4xx) are not stored; the frontend drops the key after a definite error anyway.
- The record is inserted in the **same transaction** as the business change.
- All idempotent writes run under `BEGIN IMMEDIATE`, so a second identical request waits for the first and then finds its record.
- Keep records at least 30 days. A daily cleanup may delete older ones.
- Business uniqueness still applies on its own (a vehicle period can be billed once, a payment reversed once), so a new key cannot duplicate money either.

### 4.8 CSRF (every POST, PATCH, PUT, DELETE, including login and logout)

Reject with `403 CSRF_REJECTED` unless all hold:

1. `X-Requested-With: XMLHttpRequest`.
2. `Origin` is in `ALLOWED_ORIGINS`. If `Origin` is absent, the scheme+host+port of `Referer` must be in the list. Both absent: reject.
3. If a `Content-Type` header is present it is `application/json` (parameters like `; charset=utf-8` allowed). A request with a non-empty body must have it.

The frontend sends `Content-Type: application/json` on every write, including bodyless ones (`/auth/activity`, `/auth/logout`, `/invoices/{id}/issue`). Treat an empty body as "no body", not as invalid JSON.

### 4.9 Sessions

- Server-side. Cookie value: `secrets.token_urlsafe(32)`. Store only `sha256(value)`.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`, `Secure` per config, name per config. No `Max-Age` (session cookie); expiry is enforced server-side.
- Idle timeout 30 minutes, absolute lifetime 8 hours, both checked on every request. An expired session is revoked and the request gets `401 SESSION_EXPIRED`.
- Only these extend the idle time: successful writes and `POST /auth/activity`. New idle expiry = `min(now + 30 min, absolute_expires_at)`. `GET` requests never extend it (the frontend polls and refetches in the background).
- The frontend calls `POST /auth/activity` at most once a minute while the user is active, and when they click "Stay signed in". It warns two minutes before `idle_expires_at` and treats that instant as the end.
- Login always creates a new session. Logout revokes it and clears the cookie.
- Deactivating a user, changing their role, or resetting their password revokes all their sessions (later endpoints; the CLI reset must do it now).

### 4.10 Roles

- `operator` and `admin`. Every route declares its access with a dependency: `public`, `signed_in`, `staff`, or `admin`. Add a test that fails if any route lacks one.
- Users with `must_change_password: true` may call only `GET /auth/session`, `POST /auth/activity`, `POST /auth/logout`, health routes, and (later) `POST /auth/change-password`. Everything else: `403 PASSWORD_CHANGE_REQUIRED`.
- Admin-only today: `POST /payments/{id}/reverse`, and parking rate or end-date changes (checked inside the handler because operators may do first setup on the same route).

### 4.11 Lot

- Exactly one `lots` row. If none exists, every staff route returns `503 LOT_SETUP_REQUIRED` (the frontend shows a full-page "finish lot setup" message). Auth and health routes still work.
- The lot's `time_zone` (IANA name) defines "today" everywhere.

### 4.12 Headers on every response

- `X-Request-ID`.
- `Cache-Control: private, no-store` on all `/api/v1` responses except health.
- `X-Content-Type-Options: nosniff`.

### 4.13 Logging

Structured JSON: `request_id`, method, route template (not the raw path), status, duration ms, user ID. Never log passwords, cookies, session IDs, `Idempotency-Key` values, request bodies, phone numbers, emails, addresses, or plates.

---

## 5. Database schema (SQLite)

Write it as the first Alembic migration. Conventions: UUIDs as `TEXT`, business dates as `TEXT 'YYYY-MM-DD'`, instants as `TEXT` ISO UTC with `Z`, booleans as `INTEGER 0/1`, money as `INTEGER` cents. ISO strings compare correctly as text.

Financial tables (`invoices`, `invoice_lines`, `payments`, `payment_allocations`, `payment_reversals`, `vehicle_rates`, `audit_events`) are append-only: never `DELETE`, never change an amount after issue. Status changes and `released_at` stamps are the only updates.

```sql
-- Connection PRAGMAs (every connection): journal_mode=WAL, foreign_keys=ON,
-- busy_timeout=5000, synchronous=NORMAL

CREATE TABLE lots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  time_zone TEXT NOT NULL,                 -- IANA, e.g. America/Los_Angeles
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,                     -- stored trimmed and lowercased
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('operator','admin')),
  is_active INTEGER NOT NULL DEFAULT 1,
  preferred_language TEXT CHECK (preferred_language IN ('zh-CN','en')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_users_email ON users (email);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,         -- sha256 of the cookie value
  created_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  idle_expires_at TEXT NOT NULL,
  absolute_expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX ix_sessions_user ON sessions (user_id);

CREATE TABLE login_failures (              -- rate limiting; prune rows older than 1 day
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX ix_login_failures_email ON login_failures (email, created_at);
CREATE INDEX ix_login_failures_ip ON login_failures (ip, created_at);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  type TEXT NOT NULL CHECK (type IN ('individual','business')),
  display_name TEXT NOT NULL,
  sort_key TEXT NOT NULL,                  -- see 6.6
  contact_name TEXT,
  phone TEXT,
  phone_digits TEXT,                       -- digits only, for search
  email TEXT,
  usdot_number TEXT CHECK (usdot_number GLOB '[0-9]*' AND length(usdot_number) BETWEEN 1 AND 8),
  address_line1 TEXT, address_line2 TEXT, city TEXT, state TEXT, postal_code TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_customers_active_usdot ON customers (usdot_number)
  WHERE is_active = 1 AND usdot_number IS NOT NULL;
CREATE INDEX ix_customers_sort ON customers (sort_key, id);

CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('truck','trailer','combination','compact')),
  unit_number TEXT,
  unit_number_key TEXT,                    -- lower(unit_number)
  plate_number TEXT,                       -- as typed, for display
  plate_normalized TEXT,                   -- upper, letters and digits only
  plate_jurisdiction TEXT,                 -- upper
  usdot_number TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_vehicles_customer ON vehicles (customer_id);
CREATE UNIQUE INDEX ux_vehicles_active_plate ON vehicles (plate_normalized, plate_jurisdiction)
  WHERE is_active = 1 AND plate_normalized IS NOT NULL;
CREATE UNIQUE INDEX ux_vehicles_active_unit ON vehicles (usdot_number, unit_number_key)
  WHERE is_active = 1 AND usdot_number IS NOT NULL AND unit_number_key IS NOT NULL;

CREATE TABLE vehicle_parking (             -- at most one per vehicle
  vehicle_id TEXT PRIMARY KEY REFERENCES vehicles(id),
  starts_on TEXT NOT NULL,
  ends_on TEXT,                            -- exclusive; NULL = no end
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (ends_on IS NULL OR ends_on > starts_on)
);

CREATE TABLE vehicle_rates (               -- append-only rate history
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  effective_on TEXT NOT NULL,
  monthly_rate_cents INTEGER NOT NULL CHECK (monthly_rate_cents BETWEEN 0 AND 999999999),
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE (vehicle_id, effective_on)
);

CREATE TABLE billing_runs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  through_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('preview','issued')),
  lines_json TEXT NOT NULL,                -- the MonthlyCharge lines exactly as returned
  total_cents INTEGER NOT NULL,
  credit_available_cents INTEGER NOT NULL,
  amount_due_after_credit_cents INTEGER NOT NULL,
  already_billed_count INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,               -- see 6.4
  invoice_numbers_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  issued_at TEXT
);

CREATE TABLE invoice_counter (             -- single row; never reused
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_value INTEGER NOT NULL
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  customer_name_snapshot TEXT NOT NULL,
  invoice_number TEXT UNIQUE,              -- NULL while draft
  status TEXT NOT NULL CHECK (status IN ('draft','issued','void')),
  source_type TEXT NOT NULL CHECK (source_type IN ('manual','monthly_parking','opening_balance')),
  description TEXT,                        -- NULL for monthly charges
  issued_on TEXT,
  due_on TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),  -- 0 possible when a free-parking line is billed
  billing_run_id TEXT REFERENCES billing_runs(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_invoices_customer ON invoices (customer_id, status, issued_on);

CREATE TABLE invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  charge_type TEXT NOT NULL CHECK (charge_type IN ('monthly_parking','manual','opening_balance')),
  description TEXT,
  amount_cents INTEGER NOT NULL,
  vehicle_id TEXT REFERENCES vehicles(id),
  vehicle_label TEXT, unit_number TEXT, plate_number TEXT, plate_jurisdiction TEXT, usdot_number TEXT,
  period_starts_on TEXT,                   -- full period start (the line key uses this)
  period_ends_on TEXT,
  service_starts_on TEXT,
  service_ends_on TEXT,
  service_days INTEGER,
  period_days INTEGER,
  is_void INTEGER NOT NULL DEFAULT 0,      -- mirrors invoice void (later)
  created_at TEXT NOT NULL
);
-- A vehicle period can be billed once across non-void invoices.
CREATE UNIQUE INDEX ux_lines_period ON invoice_lines (vehicle_id, period_starts_on, charge_type)
  WHERE is_void = 0 AND vehicle_id IS NOT NULL;

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  customer_name_snapshot TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 1 AND 999999999),
  effective_on TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash','check','bank_transfer','external_card','other')),
  reference TEXT,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('received','reversed')),
  recorded_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX ix_payments_customer ON payments (customer_id, status, effective_on);
CREATE INDEX ix_payments_effective ON payments (effective_on, created_at, id);

CREATE TABLE payment_reversals (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id),
  reason TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  released_at TEXT,                        -- set by reversal; row is never deleted
  released_by TEXT REFERENCES users(id)
);
CREATE INDEX ix_alloc_payment ON payment_allocations (payment_id) WHERE released_at IS NULL;
CREATE INDEX ix_alloc_invoice ON payment_allocations (invoice_id) WHERE released_at IS NULL;

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),      -- NULL for CLI or failed login
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX ix_audit_resource ON audit_events (resource_type, resource_id, created_at);

CREATE TABLE idempotency_records (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  key TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (actor_id, key)
);
```

Notes:
- Opening balances are invoices with `source_type = 'opening_balance'`, issued at import time. They are never cash collected. The import workflow itself is a later design.
- `customer_name` on vehicle and payment responses is the customer's **current** `display_name` (join). Snapshots are kept for future receipts and PDFs.
- Use `BEGIN IMMEDIATE` for every non-GET request. With pysqlite, set `isolation_level = None` in the `connect` event and emit the `BEGIN` yourself in the `begin` event (SQLAlchemy "pysqlite serializable" recipe), choosing `BEGIN IMMEDIATE` when the request is a write (for example, a flag in `Session.info` set by the DB dependency).

---

## 6. Shared domain logic

### 6.1 Balances (`ledger/balances.py`)

One module computes every balance. The ledger endpoint, the customer list, and the dashboard all call it.

Definitions, with `today` in the lot time zone:

| Term | Definition |
| --- | --- |
| Active allocation | `payment_allocations` row with `released_at IS NULL` whose payment has `status = 'received'` |
| Invoice remaining | `max(0, total_cents - sum(active allocations to it))`, only for `status = 'issued'` |
| `outstanding` | Sum of remaining over the customer's issued invoices |
| `overdue` | Sum of remaining over issued invoices with `due_on < today`. Due today is not overdue. Always `<= outstanding` |
| Payment allocated | Sum of its active allocations (0 if reversed) |
| Payment available credit | `amount - allocated` if received, else 0 |
| `unapplied_credit` | Sum of available credit over the customer's received payments |
| `net_balance` | `outstanding - unapplied_credit`. Positive = owes (UI shows red). Negative = customer credit (UI shows green, absolute value) |
| `monthly_parking` | Sum of the **rate in effect today** over the customer's vehicles whose parking covers today (`starts_on <= today` and (`ends_on` is null or `ends_on > today`)). Information only |
| `unbilled_parking` | Sum of `monthly_charges(customer vehicles, through=today)` lines not yet billed (6.3). Information only, never debt |
| `last_payment` | Latest received payment by `effective_on` desc, `created_at` desc, `id` desc; or `null` |

Reference SQL for a batch of customers (used by `GET /customers` so there are no per-row queries):

```sql
WITH alloc_by_invoice AS (
  SELECT a.invoice_id, SUM(a.amount_cents) AS paid
  FROM payment_allocations a JOIN payments p ON p.id = a.payment_id
  WHERE a.released_at IS NULL AND p.status = 'received'
  GROUP BY a.invoice_id
),
inv AS (
  SELECT i.customer_id,
         MAX(0, i.total_cents - COALESCE(x.paid, 0)) AS remaining,
         i.due_on
  FROM invoices i LEFT JOIN alloc_by_invoice x ON x.invoice_id = i.id
  WHERE i.status = 'issued'
),
inv_sum AS (
  SELECT customer_id,
         SUM(remaining) AS outstanding,
         SUM(CASE WHEN due_on < :today THEN remaining ELSE 0 END) AS overdue
  FROM inv GROUP BY customer_id
),
alloc_by_payment AS (
  SELECT payment_id, SUM(amount_cents) AS used
  FROM payment_allocations WHERE released_at IS NULL GROUP BY payment_id
),
credit AS (
  SELECT p.customer_id, SUM(p.amount_cents - COALESCE(y.used, 0)) AS credit
  FROM payments p LEFT JOIN alloc_by_payment y ON y.payment_id = p.id
  WHERE p.status = 'received'
  GROUP BY p.customer_id
)
SELECT c.id,
       COALESCE(s.outstanding, 0) AS outstanding,
       COALESCE(s.overdue, 0) AS overdue,
       COALESCE(k.credit, 0) AS unapplied_credit,
       COALESCE(s.outstanding, 0) - COALESCE(k.credit, 0) AS net_balance
FROM customers c
LEFT JOIN inv_sum s ON s.customer_id = c.id
LEFT JOIN credit k ON k.customer_id = c.id;
```

`monthly_parking` and `unbilled_parking` need the period math in 6.3, so compute them in Python. One lot has at most a few hundred vehicles, so this is cheap.

### 6.2 Rate in effect

For a vehicle with parking and rate history sorted by `effective_on`:

- `rate_on(d)` = the last rate with `effective_on <= d`, else the first rate.
- Vehicle response `parking.monthly_rate` = `rate_on(today)`. Future rates appear in `rate_history` only.
- `rate_history` is returned sorted by `effective_on` ascending.

### 6.3 Monthly charge periods (port exactly)

Periods start on the parking `starts_on` day and recur monthly on that day. If a month is shorter, use its last day, then return to the original day in later months (Jan 31, Feb 28, Mar 31). Billing is in advance: a period is included when its start is on or before `through`. The first period is a full month from `starts_on`. Only a service end or a mid-period rate change prorates. Round half up once per line.

```python
import calendar
from dataclasses import dataclass
from datetime import date
from itertools import pairwise

@dataclass(frozen=True)
class Rate:
    effective_on: date
    cents: int

@dataclass(frozen=True)
class Line:
    key: str            # f"{vehicle_id}:{period_start}:{period_end}" (full period, ISO dates)
    vehicle_id: str
    vehicle_label: str
    period_start: date  # stored on invoice_lines.period_starts_on
    period_end: date
    starts_on: date     # service start, returned to the client
    ends_on: date       # service end (exclusive), returned to the client
    service_days: int
    period_days: int
    amount_cents: int

def boundary(year: int, month_index: int, anchor: int) -> date:
    """month_index is zero-based and may exceed 11."""
    y, m0 = year + month_index // 12, month_index % 12
    last = calendar.monthrange(y, m0 + 1)[1]
    return date(y, m0 + 1, min(anchor, last))

def monthly_charges(vehicle_id: str, label: str, starts_on: date, ends_on: date | None,
                    rates: list[Rate], through: date) -> list[Line]:
    if starts_on > through:
        return []
    rates = sorted(rates, key=lambda r: r.effective_on)
    anchor, year, first_month = starts_on.day, starts_on.year, starts_on.month - 1
    lines: list[Line] = []
    i = 0
    while True:
        p_start = boundary(year, first_month + i, anchor)
        p_end = boundary(year, first_month + i + 1, anchor)
        i += 1
        if p_start > through or (ends_on and p_start >= ends_on):
            break
        s_start = max(p_start, starts_on)
        s_end = min(p_end, ends_on) if ends_on else p_end
        if s_start >= s_end:
            continue
        cuts = [s_start, *[r.effective_on for r in rates if s_start < r.effective_on < s_end], s_end]
        weighted = 0
        for a, b in pairwise(cuts):
            applicable = [r for r in rates if r.effective_on <= a]
            rate = applicable[-1] if applicable else rates[0]
            weighted += rate.cents * (b - a).days
        days = (p_end - p_start).days
        amount = (weighted * 2 + days) // (days * 2)   # half up, once per line
        lines.append(Line(f"{vehicle_id}:{p_start.isoformat()}:{p_end.isoformat()}", vehicle_id,
                          label, p_start, p_end, s_start, s_end, (s_end - s_start).days, days, amount))
    return lines
```

- `vehicle_label` = `unit_number`, else `plate_number`, else `usdot_number`, else `""`.
- Include every vehicle of the customer that has parking, active or not (an ended vehicle may still have unbilled past periods).
- A line is **already billed** when a non-void `invoice_lines` row exists with the same `vehicle_id`, `period_starts_on`, and `charge_type = 'monthly_parking'`. `unbilled` = lines that are not already billed.
- Free parking ($0) produces $0 lines. They are billed like any other line so the period is marked as billed.

### 6.4 Billing preview fingerprint

`fingerprint = sha256(json.dumps({...}, sort_keys=True))` of:

- `vehicles`: sorted list of `[vehicle_id, version]` for every vehicle of the customer (parking saves bump the vehicle version, so rate and end-date changes are covered),
- `outstanding` and `unapplied_credit` of the customer (6.1).

Issue recomputes it. Different: `412 BILLING_PREVIEW_STALE`.

### 6.5 Automatic payment allocation and existing credit

Use one shared allocation routine for both workflows. Eligible invoices belong to the same customer, have `status = 'issued'`, and have a positive remaining collectible balance. Order them by `due_on` ascending, then `issued_on` ascending, then `id` ascending. Include invoices not yet due, manual charges, and opening balances; skip drafts, void invoices, and fully paid invoices.

**Recording a new payment:** in the record transaction, allocate only this new payment to all eligible invoices, oldest first. Allocate `min(payment available, invoice remaining)` per invoice until the payment is exhausted or all eligible invoices are paid. Any remainder becomes unapplied customer credit. Do not consume other existing payments' credit or create another receipt.

**Issuing monthly charges with `apply_credit: true`:** in the issue transaction, apply the customer's received payments with available credit to the **newly created invoices only**. Walk payments by `effective_on`, then `created_at`, then `id` ascending, using the same invoice ordering and amount limits.

For each allocation, insert a `payment_allocations` row (`created_by` = acting user), bump the payment `version`, and write audit `payment.allocated` with `reason` = invoice number. Return the payment's final version and allocated/credit amounts after recording.

Payment creation, allocations, audit events, and the idempotency record commit atomically under `BEGIN IMMEDIATE`. Replays do not allocate twice. A reversal releases every allocation from that payment, restoring the affected invoices' unpaid balances.

### 6.6 Search and sort helpers

- Text search is case-insensitive substring. Use `instr(lower(col), lower(:q)) > 0` (or `LIKE` with `ESCAPE '\'` after escaping `%`, `_`, `\`). Trim `q`; an empty `q` means no filter.
- Customer search fields: `display_name`, `contact_name`, `phone`, `email`, `usdot_number`. If `q` has 3 or more digits, also match `digits(q)` inside `phone_digits` and `usdot_number`.
- Vehicle search fields: `unit_number`, `plate_number`, `usdot_number`, customer `display_name`; also match `normalize_plate(q)` inside `plate_normalized` when it has 2 or more characters.
- `normalize_plate(s)` = uppercase, keep only `A-Z0-9`.
- Customer `sort_key`: lowercased `display_name` for now. Chinese ordering is open decision 12.4.

---

## 7. Endpoint reference

Shapes are TypeScript-style for brevity. `Money` = `{ amount: int, currency: "USD" }`. `Date` = `"YYYY-MM-DD"`. `Instant` = ISO UTC string. `T | null` fields are always present.

### 7.1 Auth

**`POST /auth/login`** (public, CSRF)

Request: `{ email: string, password: string }`. Trim and lowercase the email before lookup.

Response `200`, plus `Set-Cookie`:

```ts
SessionResponse = {
  user: {
    id: string, email: string, name: string,
    role: "operator" | "admin", is_active: boolean,
    preferred_language: "zh-CN" | "en" | null,
    must_change_password: boolean
  },
  session: { idle_expires_at: Instant, absolute_expires_at: Instant }
}
```

Rules:
- Unknown email or wrong password: `401 INVALID_CREDENTIALS`. Verify a dummy Argon2 hash for unknown emails so timing is similar.
- Correct password but `is_active = 0`: `403 ACCOUNT_INACTIVE`.
- Rate limit: 5 failures per 15 minutes per email, 20 per 15 minutes per IP. Over the limit: `429 RATE_LIMITED` with `Retry-After`. Checked before verifying the password.
- Rehash on login when Argon2 parameters changed.
- Audit `auth.login` or `auth.login_failed` (no password, email only in `after_json` for failures).

**`GET /auth/session`** (signed in): `200 SessionResponse`. No session: `401 SESSION_EXPIRED`. Does not extend idle time.

**`POST /auth/activity`** (signed in, CSRF, no body): extends idle time (4.9) and returns `200 SessionResponse` with the new `idle_expires_at`.

**`POST /auth/logout`** (CSRF, no body): revokes the session if there is one, clears the cookie, returns `204`. Works without a valid session. Audit `auth.logout` when a session existed.

### 7.2 Lot

**`GET /lots/current`** (staff): `200 { id: string, name: string, time_zone: string, currency: "USD" }`. No lot: `503 LOT_SETUP_REQUIRED`.

### 7.3 Customers

```ts
Customer = {
  id: string, version: int,
  type: "individual" | "business",
  display_name: string,
  contact_name: string | null, phone: string | null, email: string | null,
  usdot_number: string | null,
  address_line1: string | null, address_line2: string | null,
  city: string | null, state: string | null, postal_code: string | null,
  notes: string | null,
  is_active: boolean, created_at: Instant, updated_at: Instant
}
CustomerListItem = Customer & { net_balance: Money, overdue_balance: Money, truck_count: int }
```

**`GET /customers`** (staff) returns `Paged<CustomerListItem>`.

| Param | Rule |
| --- | --- |
| `q` | 6.6 |
| `include_inactive` | `true` includes inactive customers. Default: active only |
| `overdue_only` | `true` keeps only `overdue_balance > 0`. Applied before paging |
| `page`, `page_size` | 4.3 |

- Sort: `sort_key`, then `id`.
- `net_balance` and `overdue_balance` come from 6.1 (`overdue_balance` = `overdue`). Compute for the page in one query.
- `truck_count`: active vehicles of type `truck` or `combination`. The UI no longer shows it, but it stays in the contract.

**`POST /customers`** (staff, CSRF) returns `201 Customer`.

Body (all keys optional except `type` and `display_name`; unknown keys, including `is_active`, give `422 VALIDATION_FAILED` with `NOT_ALLOWED`):

```ts
CustomerWrite = {
  type: "individual" | "business", display_name: string,
  contact_name?: string | null, phone?: string | null, email?: string | null,
  usdot_number?: string | null, address_line1?: string | null, address_line2?: string | null,
  city?: string | null, state?: string | null, postal_code?: string | null, notes?: string | null
}
```

Rules:
- Trim every string. Empty becomes `null`.
- `display_name` required after trimming: `REQUIRED`. Max lengths: `display_name`, `contact_name`, `email` 200; address fields and `city` 200; `state` 50; `postal_code` 20; `phone` 50; `notes` 2000 (`TOO_LONG`).
- `email`, when present, matches `^[^\s@]+@[^\s@]+\.[^\s@]+$`: else `INVALID_EMAIL`.
- `usdot_number`, when present, is 1 to 8 digits: else `INVALID_USDOT`. Never strip non-digits silently.
- Both `individual` and `business` may have a USDOT number and a contact name (owner-operators).
- Active customer USDOT must be unique among active customers: `409 USDOT_ALREADY_IN_USE`, `field_errors.usdot_number = ["USDOT_ALREADY_IN_USE"]`.
- Set `sort_key` and `phone_digits`. Audit `customer.created`.

**`GET /customers/{id}`** (staff): `200 Customer` or `404 CUSTOMER_NOT_FOUND`. Inactive customers are returned.

**`PATCH /customers/{id}`** (staff, CSRF, If-Match) returns `200 Customer`.

- Body: any subset of `CustomerWrite` plus `is_active: boolean`. Only changed fields are sent. Unknown keys: `422 NOT_ALLOWED`.
- Same rules as create, validated against the merged record.
- USDOT uniqueness is checked when the resulting record is active, including on reactivation.
- Deactivating keeps the balance; payments can still be recorded. There is no delete.
- Bump `version`. Audit `customer.updated` (before/after of changed fields), or `customer.deactivated` / `customer.reactivated`.

**`GET /customers/{id}/ledger`** (staff): `200 CustomerLedger` or `404 CUSTOMER_NOT_FOUND`.

```ts
CustomerLedger = {
  as_of: Instant,
  outstanding: Money, overdue: Money, unapplied_credit: Money, net_balance: Money,
  monthly_parking: Money, unbilled_parking: Money,
  last_payment: { id: string, amount: Money, effective_on: Date, method: PaymentMethod } | null
}
```

All values per 6.1. `net_balance` may be negative (credit).

### 7.4 Vehicles and monthly parking

```ts
Vehicle = {
  id: string, version: int,
  customer_id: string, customer_name: string,          // current customer display_name
  vehicle_type: "truck" | "trailer" | "combination" | "compact",
  unit_number: string | null, plate_number: string | null,
  plate_jurisdiction: string | null, usdot_number: string | null,
  is_active: boolean, created_at: Instant, updated_at: Instant,
  parking: null | {
    starts_on: Date,
    ends_on: Date | null,                               // exclusive
    monthly_rate: Money,                                // rate_on(today), 6.2
    rate_history: { effective_on: Date, monthly_rate: Money, reason: string }[]
  }
}
ParkingWrite = {
  starts_on: Date, ends_on: Date | null, monthly_rate: Money, effective_on: Date, reason: string
}
```

**`GET /vehicles`** (staff) returns `Paged<Vehicle>`.

| Param | Rule |
| --- | --- |
| `q` | 6.6 |
| `customer_id` | Only this customer's vehicles. The customer page uses `customer_id=X&page_size=100` and shows `total` as "Vehicles (N)" |
| `include_inactive` | `true` includes inactive vehicles. Default: active only |
| `page`, `page_size` | 4.3 |

Sort: customer `sort_key`, then vehicle label (6.3) case-insensitive, then `id`.

**Identity rules** (create and patch, checked on the merged record). Collect all of them into one `422 VALIDATION_FAILED`:

| Condition | Field | Code |
| --- | --- | --- |
| `usdot_number` present and not 1 to 8 digits | `usdot_number` | `INVALID_USDOT` |
| `plate_number` without `plate_jurisdiction` | `plate_jurisdiction` | `REQUIRED` |
| `plate_jurisdiction` without `plate_number` | `plate_number` | `REQUIRED` |
| Neither plate nor USDOT | `usdot_number` | `IDENTIFIER_REQUIRED` |
| USDOT present, no plate, no unit number | `unit_number` | `REQUIRED` |

Normalization: trim, empty to `null`, `plate_jurisdiction` uppercased, `plate_number` stored as typed plus `plate_normalized`. Max lengths: unit 50, plate 20, jurisdiction 10.

Uniqueness among **other active** vehicles (checked only if the result is active):
- Same `plate_normalized` and `plate_jurisdiction`: `409 PLATE_ALREADY_IN_USE`, `field_errors.plate_number`.
- Same `usdot_number` and case-insensitive `unit_number`: `409 UNIT_NUMBER_ALREADY_IN_USE`, `field_errors.unit_number`.

A vehicle USDOT that differs from its customer's USDOT is allowed (the UI only warns).

**`POST /vehicles`** (staff, CSRF) returns `201 Vehicle`.

Body: `{ customer_id, vehicle_type, unit_number, plate_number, plate_jurisdiction, usdot_number, parking?: ParkingWrite }`.

1. Unknown `customer_id`: `422 VALIDATION_FAILED`, `customer_id: ["REQUIRED"]`. Inactive customers may get a vehicle without parking.
2. Bad `vehicle_type`: `422 VALIDATION_FAILED`, `vehicle_type: ["REQUIRED"]`.
3. Identity rules, then uniqueness.
4. If `parking` is present, it must pass the first-setup rules below **and** the customer must be active. Any failure: `422 INVALID_PARKING` with nothing saved.
5. Insert vehicle, `vehicle_parking`, and the first `vehicle_rates` row in one transaction. Audit `vehicle.created` and, with parking, `parking.created`.

The add-vehicle form sends `parking` when a monthly amount (including `0`) is typed, with `ends_on: null`, `effective_on = starts_on`, and a default reason.

**`GET /vehicles/{id}`** (staff): `200 Vehicle` or `404 VEHICLE_NOT_FOUND`.

**`PATCH /vehicles/{id}`** (staff, CSRF, If-Match) returns `200 Vehicle`.

- Body: any subset of `vehicle_type`, `unit_number`, `plate_number`, `plate_jurisdiction`, `usdot_number`, `is_active`. `customer_id` gives `422 NOT_ALLOWED` (changing owner is a later workflow).
- Identity rules and uniqueness on the merged record.
- Deactivating (`is_active: false` on an active vehicle) with parking whose `ends_on` is null or after today: `409 PARKING_STILL_ACTIVE`.
- Bump `version`. Audit `vehicle.updated`, `vehicle.deactivated`, or `vehicle.reactivated`.

**`POST /vehicles/{id}/parking`** (staff, CSRF, If-Match) returns `200 Vehicle` with `parking` filled.

Shape checks first, as `422 VALIDATION_FAILED` with one field: `starts_on` / `effective_on` valid dates (field `starts_on`), `ends_on` null or a valid date after `starts_on` (`ends_on`), `monthly_rate` integer `0..999_999_999` in USD (`monthly_rate`), `reason` 1 to 1000 characters after trimming (`reason`). Field code `INVALID`.

Then, comparing with the stored parking (`latest` = last rate by `effective_on`):

| Case | Rule | Error |
| --- | --- | --- |
| No parking yet (first setup, any staff) | Vehicle and customer active | `409 INVALID_PARKING` |
| First setup | `effective_on == starts_on` | `422 INVALID_EFFECTIVE_DATE` |
| Existing | `starts_on` unchanged | `409 SERVICE_HISTORY_IMMUTABLE` |
| Existing | Rate changed (`monthly_rate != latest`) or `ends_on` changed requires admin | `403 ADMIN_REQUIRED` |
| Rate changed | `effective_on > today` and `effective_on > latest.effective_on`. Append a `vehicle_rates` row | `409 INVALID_EFFECTIVE_DATE` |
| Rate not changed | `effective_on == latest.effective_on` | `409 INVALID_EFFECTIVE_DATE` |

- An end-date change sends the latest rate and `latest.effective_on` unchanged, plus the new `ends_on` (or `null` to remove the end).
- Changing `ends_on` never removes or edits charges already issued. Billing simply stops producing periods at the new end.
- Saving parking never creates debt.
- Bump the vehicle `version`. Audit `parking.created`, `parking.rate_scheduled` (with reason), or `parking.end_changed` (with reason and before/after).

### 7.5 Billing runs (monthly charges)

```ts
MonthlyCharge = {
  key: string,                 // "{vehicle_id}:{period_start}:{period_end}"
  vehicle_id: string, vehicle_label: string,
  starts_on: Date, ends_on: Date,          // service part of the period, end exclusive
  service_days: int, period_days: int,
  amount: Money
}
BillingRun = {
  id: string, customer_id: string, through_date: Date,
  lines: MonthlyCharge[],
  total: Money,
  credit_available: Money,
  amount_due_after_credit: Money,
  already_billed_count: int,
  status: "preview" | "issued",
  invoice_numbers: string[]
}
```

**`POST /billing-runs/preview`** (staff, CSRF) returns `200 BillingRun`.

Body: `{ customer_id: string, through_date: Date }`.

1. Unknown customer: `404 CUSTOMER_NOT_FOUND`. Inactive customers can be billed.
2. `through_date` not a valid date, or after today: `422 INVALID_BILLING_RANGE`. The UI defaults it to today.
3. Compute all lines for the customer's vehicles through `through_date` (6.3). `lines` = unbilled lines, sorted by `vehicle_label`, then `starts_on`. `already_billed_count` = number of already-billed lines.
4. `total` = sum of `lines`. `credit_available` = `unapplied_credit`.
5. `amount_due_after_credit` = `max(0, outstanding + total - unapplied_credit)`. This is "what the customer will owe after issuing". It does **not** depend on the credit checkbox, because applying credit only moves existing credit onto the new invoices and does not change the net amount owed.
6. Save the run as `preview` with `lines_json` and the fingerprint (6.4). Not idempotent; each call creates a new preview row. Delete never-issued previews older than 7 days in a daily cleanup.

The UI shows "Nothing to bill" when `lines` is empty and disables Issue.

**`POST /billing-runs/{id}/issue`** (staff, CSRF, Idempotency-Key) returns `200 BillingRun` with `status: "issued"`.

Body: `{ apply_credit: boolean }`. The UI sends `true` only when the box is ticked and `credit_available > 0`.

In one `BEGIN IMMEDIATE` transaction:

1. Idempotency lookup (4.7, operation `billing_run.issue`). Replay returns the issued run.
2. Unknown run: `404 BILLING_RUN_NOT_FOUND`. Run already `issued`: `409 ALREADY_ISSUED`.
3. Fingerprint changed: `412 BILLING_PREVIEW_STALE`.
4. Recompute unbilled lines through `through_date`. If the run has no lines, or any run line key is no longer unbilled: `409 VEHICLE_PERIOD_ALREADY_BILLED`. The `ux_lines_period` index is the final guard; map its `IntegrityError` to the same code.
5. `issued_on = today`. Group lines by due date, where `due_on = max(line.starts_on, issued_on)`. One invoice per group, `source_type = 'monthly_parking'`, `description = null`, `total` = sum of its lines, a new invoice number each (7.6). Insert `invoice_lines` with vehicle snapshot, period and service dates, and amount.
6. If `apply_credit`, apply credit to the new invoices (6.5).
7. Mark the run `issued`, set `invoice_numbers` (in invoice creation order) and `issued_at`.
8. Store the idempotency record. Audit `billing_run.issued` and `invoice.issued` per invoice.

UI handling to keep in mind: `412` and `409 VEHICLE_PERIOD_ALREADY_BILLED` / `ALREADY_ISSUED` make it refetch a new preview. 5xx or timeout make it retry the same run with the same key and body.

### 7.6 Invoices

```ts
Invoice = {
  id: string, version: int, customer_id: string,
  invoice_number: string | null,          // null while draft
  status: "draft" | "issued" | "void",
  source_type: "manual" | "monthly_parking" | "opening_balance",
  description: string | null,             // null for monthly charges
  issued_on: Date | null,
  due_on: Date,
  total: Money
}
```

Invoice numbers: `OL-` plus a zero-padded 6-digit counter (`OL-000123`), from `invoice_counter` incremented inside the issuing transaction. Assigned only at issue. Never reused. Gaps after a rolled-back transaction are fine; duplicates are not. (The frontend treats the number as an opaque string.)

**`GET /invoices`** (staff) returns `Paged<Invoice>`.

| Param | Rule |
| --- | --- |
| `customer_id` | Required for now. Missing: `422 CUSTOMER_REQUIRED` |
| `source_type` | Optional. When **absent**, return every source (the Transactions tab needs all of them) |
| `q` | Case-insensitive substring of `invoice_number` or `description` |
| `from`, `to` | Inclusive range on `issued_on` |
| `page`, `page_size` | 4.3 |

- Only `status = 'issued'` invoices are returned. Drafts never appear (and void ones are not shown yet).
- Sort: `issued_on` desc, `invoice_number` desc, `id` desc.

**`POST /invoices`** (staff, CSRF, Idempotency-Key) creates a one-time charge draft. Returns `201 Invoice` with `status: "draft"`, `invoice_number: null`, `issued_on: null`, `source_type: "manual"`.

Body: `{ customer_id: string, due_on: Date, description: string, amount: Money }`.

- Unknown customer: `404 CUSTOMER_NOT_FOUND`.
- `description` trimmed, 1 to 200 characters: else `422 VALIDATION_FAILED`, `description: ["REQUIRED"]` (or `TOO_LONG`).
- `amount.amount` integer `1..999_999_999`: else `amount: ["INVALID"]`.
- `due_on` valid date: else `due_on: ["INVALID"]`. Past dates are allowed.
- Insert one invoice line (`charge_type = 'manual'`). Drafts never count toward balances. Audit `invoice.draft_created`.

**`POST /invoices/{id}/issue`** (staff, CSRF, Idempotency-Key, no body) returns `200 Invoice` with `status: "issued"`, `invoice_number`, `issued_on = today`.

- Unknown: `404 INVOICE_NOT_FOUND`. Not a draft: `409 ALREADY_ISSUED`.
- Bump `version`. Audit `invoice.issued`.
- The UI creates the draft with one key and issues it with a second key. On an unknown outcome it retries each step with its own key.

### 7.7 Payments

```ts
PaymentMethod = "cash" | "check" | "bank_transfer" | "external_card" | "other"
Payment = {
  id: string, version: int,
  customer_id: string, customer_name: string,    // current display_name
  amount: Money,
  allocated_amount: Money,                       // 0 when reversed
  available_credit: Money,                       // amount - allocated, 0 when reversed
  effective_on: Date,
  method: PaymentMethod,
  reference: string | null, notes: string | null,
  status: "received" | "reversed",
  recorded_by: { id: string, name: string },
  created_at: Instant,
  reversal: null | { reason: string, actor: { id: string, name: string }, created_at: Instant },
  audit_events: {
    action: "recorded" | "reversed" | "allocated",
    actor_id: string, reason: string | null, created_at: Instant
  }[]                                            // oldest first
}
```

`audit_events` is built from `audit_events` rows for this payment (`payment.recorded`, `payment.reversed`, `payment.allocated` mapped to the short action names). For `allocated`, `reason` is the invoice number.

**`GET /payments`** (staff) returns `Paged<Payment>`.

| Param | Rule |
| --- | --- |
| `customer_id` | Optional filter |
| `q` | Case-insensitive substring of current customer `display_name` or `reference` |
| `from`, `to` | Inclusive range on `effective_on` |
| `method` | One of `PaymentMethod` |
| `status` | `received` or `reversed` |
| `page`, `page_size` | 4.3 |

- Bad `method`, `status`, or date, or `from > to`: `422 INVALID_FILTERS`.
- Sort: `effective_on` desc, `created_at` desc, `id` desc.
- Load allocations and audit events for the page in batch queries, not per row.

**`GET /payments/{id}`** (staff): `200 Payment` or `404 PAYMENT_NOT_FOUND`.

**`POST /payments`** (staff, CSRF, Idempotency-Key) returns `201 Payment`.

Body: `{ customer_id, amount: Money, effective_on: Date, method, reference: string | null, notes: string | null }`.

- Unknown customer: `422 VALIDATION_FAILED`, `customer_id: ["REQUIRED"]`. Inactive customers can pay.
- `amount.amount` integer `1..999_999_999`: else `amount: ["INVALID"]`.
- `effective_on` valid and not after today: else `effective_on: ["INVALID"]`.
- `method` valid: else `method: ["INVALID"]`.
- `reference` trimmed, max 200; `notes` trimmed, max 2000: else `TOO_LONG`. Empty becomes `null`.
- Store `customer_name_snapshot`. Automatically allocate the new payment to the customer's oldest unpaid issued invoices using 6.5 in the same transaction. Any excess remains unapplied credit. Return the final `allocated_amount`, `available_credit`, `version`, and audit history. Replays must not create duplicate allocations.
- Audit `payment.recorded`. This only records money already received; it never charges a card.

**`POST /payments/{id}/reverse`** (admin, CSRF, If-Match, Idempotency-Key) returns `200 Payment`.

Body: `{ reason: string }`.

1. Operator: `403 ADMIN_REQUIRED` (before anything else, after session).
2. Idempotency lookup (operation `payment.reverse`; the `If-Match` value is part of the hash).
3. Unknown: `404 PAYMENT_NOT_FOUND`. `If-Match` per 4.6.
4. `reason` trimmed 1 to 1000: else `422 REASON_REQUIRED`.
5. Already reversed: `409 PAYMENT_ALREADY_REVERSED`.
6. In one transaction: set `status = 'reversed'`, bump `version`, insert `payment_reversals`, set `released_at`/`released_by` on all its active allocations (those invoices become unpaid again), audit `payment.reversed` with reason.

A reversal fixes a wrong record. It is not a refund. There is no payment edit or delete.

### 7.8 Dashboard

**`GET /reports/summary`** (staff) returns:

```ts
{
  outstanding_invoices: Money,          // sum of outstanding over ALL customers, inactive included
  overdue_invoices: Money,              // sum of overdue over all customers
  unbilled_parking: Money,              // sum of unbilled_parking over all customers
  payments_received_this_month: Money,  // received payments, effective_on from the 1st of this month through today
  total_customers: int,                 // all customers, inactive included
  total_trucks: int                     // all vehicles of type truck or combination, inactive included
}
```

The Overview shows "not due yet" as `outstanding - overdue`. It also calls `GET /customers?overdue_only=true&page_size=100`, `GET /customers?include_inactive=true&page_size=100`, `GET /vehicles?include_inactive=true&page_size=100`, and `GET /payments?page_size=10` and `?from=&to=&status=received&page_size=1`, so those must be fast.

The Overview global search uses the existing customer, vehicle, and payment list endpoints with `q` and `page_size=5`. Customer and vehicle searches send `include_inactive=true`; payment searches include both received and reversed payments. Filter before paging and return the true filtered `total`. No new search endpoint is needed. Results link to the matching record or open a payment receipt through `GET /payments/{id}`.

### 7.9 Health

- **`GET /health/live`**: `200 { "status": "ok" }`. No auth, no database.
- **`GET /health/ready`**: `200 { "status": "ok", "version": "<app version>", "schema": "<alembic head>" }` when the database answers, migrations are at head, and a lot exists. Otherwise `503` with the error shape (`code: "NOT_READY"`). No customer data.

---

## 8. Audit events

Written in the same transaction as the change. Never edited or deleted. `before_json` / `after_json` hold only the changed fields.

| Action | Resource | Reason stored |
| --- | --- | --- |
| `auth.login`, `auth.login_failed`, `auth.logout` | user | |
| `auth.admin_created`, `auth.password_reset` (CLI) | user | |
| `customer.created`, `customer.updated`, `customer.deactivated`, `customer.reactivated` | customer | |
| `vehicle.created`, `vehicle.updated`, `vehicle.deactivated`, `vehicle.reactivated` | vehicle | |
| `parking.created`, `parking.rate_scheduled`, `parking.end_changed` | vehicle | yes |
| `billing_run.issued` | billing_run | |
| `invoice.draft_created`, `invoice.issued` | invoice | |
| `payment.recorded`, `payment.allocated`, `payment.reversed` | payment | allocated: invoice number; reversed: reason |

---

## 9. Development seed data

`python -m app.cli seed-dev` loads the same synthetic data as the frontend mocks (`src/mocks/db.ts`), so both behave the same in a demo. Dates are relative to `today` in the lot time zone. Never seed real customer data.

**Lot:** `Demo Truck Parking`, `America/Los_Angeles`, `USD`, id `l0000001-0000-4000-8000-000000000001`.

**Users** (development passwords only; `seed-dev` refuses to run in production):

| Email | Name | Role | Active | Language | Password |
| --- | --- | --- | --- | --- | --- |
| `admin@example.com` | Ada Admin | admin | yes | zh-CN | `admin-password` |
| `operator@example.com` | Oscar Operator | operator | yes | zh-CN | `operator-password` |
| `inactive@example.com` | Former Staff | operator | no | en | `inactive-password` |

**Customers:**

| Name | Type | Contact | Phone | USDOT | Active | Other |
| --- | --- | --- | --- | --- | --- | --- |
| 远航货运有限公司 | business | 王建国 | (555) 010-1001 | 1234567 | yes | dispatch@yuanhang.example, 100 Harbor Way, Oakland CA 94607 |
| Pacific Haul LLC | business | Maria Lopez | (555) 010-1002 | 2345678 | yes | Hayward CA |
| 李强 | individual | | (555) 010-1003 | | yes | notes: 只有一辆车，月底付款。 |
| Dmitri Volkov | individual | | (555) 010-1004 | 3456789 | yes | dmitri@example.com |
| 金桥物流 | business | 陈美玲 | (555) 010-1005 | 4567890 | no | notes: 2026 年 6 月停用。 |

**Vehicles:**

| Owner | Type | USDOT | Unit | Plate | Active | Parking |
| --- | --- | --- | --- | --- | --- | --- |
| 远航货运 | truck | 1234567 | 12 | | yes | |
| 远航货运 | truck | 1234567 | 14 | | yes | |
| 远航货运 | trailer | | | TRL 4821 (CA) | yes | |
| Pacific Haul | combination | 2345678 | 7 | 8XYZ123 (CA) | yes | starts first of this month, $280.00, reason "Monthly customer" |
| 李强 | truck | | | 6ABC789 (CA) | yes | |
| Pacific Haul | truck | | | OLD 1234 (CA) | no | |
| 金桥物流 | truck | 4567890 | 3 | | no | |

**Money** (远航货运 only):
- Invoice `OL-000001`, opening balance, issued today minus 60 days, due today minus 45 days, $350.00.
- Invoice `OL-000002`, opening balance, issued today minus 5 days, due today plus 10 days, $100.00.
- Payment $300.00, first of this month, bank transfer, reference `WIRE-1001`, recorded by Ada Admin, fully allocated to `OL-000001`.
- Invoice counter starts at 2.

Expected result: 远航货运 outstanding $150.00, overdue $50.00, credit $0, owes $150.00. Pacific Haul has $280.00 unbilled parking.

---

## 10. Tests and golden cases

Use `pytest` with a fresh temporary SQLite file per test and an injectable `Clock`.

### 10.1 Monthly charge math (6.3)

| Case | Input | Expected |
| --- | --- | --- |
| Full month in advance | start 2026-10-15, $300, through 2026-10-15 | 1 line 2026-10-15 to 2026-11-15, $300.00 |
| Month-end anchor | start 2027-01-31, $300, through 2027-03-31 | periods 01-31 to 02-28, 02-28 to 03-31, 03-31 to 04-30 |
| End proration | start 2026-11-01, end 2026-11-16, $300, through 2026-11-30 | 15 of 30 days, $150.00 |
| Rate change in period | start 2026-11-01 $300, 2026-11-11 $400, through 2026-11-01 | (300x10 + 400x20) / 30 = $366.67 |
| Financial example | two vehicles from 2026-10-01 at $200 and $250, through 2026-10-01 | total $450.00 |
| Leap year | start 2028-01-30, through 2028-03-30 | 01-30 to 02-29, 02-29 to 03-30, 03-30 to 04-30 |
| Free parking | start today, $0 | one $0 line; after issue, `already_billed_count = 1` |
| Already billed | issue once, preview again | `lines = []`, `already_billed_count = 1` |

Also cross-check random cases against the frontend's `src/mocks/monthlyCharges.ts`.

### 10.2 Financial example (REQUIREMENTS 17.1)

Customer with two parked vehicles at $200 and $250 from the 1st of last month. Preview through the 1st of last month, issue: one invoice of $450.00. Record $300.00: it is automatically allocated to that invoice, leaving outstanding $150, credit $0, and `net_balance` $150. The customer list and the summary's `outstanding_invoices` both show $150 when this is the only customer with debt. The "$100 credit leaves $50" part of the example needs credit notes, which come later (1.2).

Also test the pay-before-billing flow: a $300 payment without invoices remains credit. Issuing $450 of monthly charges with `apply_credit: true` leaves $150 outstanding and $0 credit.

### 10.3 Ledger

Partial payment; allocation across multiple invoices in due-date order with `issued_on` and `id` tie-breakers; all invoice sources; skipping paid, draft, void, and other-customer invoices; overpayment (negative `net_balance`); no invoices (full credit); reversal releases allocations; `overdue <= outstanding`; due today is not overdue; archived customers can still pay and remain included in the summary. Verify recording actor, payment version, and allocation audit history. Replaying payment recording or reversal must not duplicate allocations or cash receipts.

### 10.4 Contract

- Every endpoint in 1.1 returns exactly the fields in section 7, with `null` rather than missing keys. Snapshot the JSON keys.
- `/openapi.json` lists every route with its response model.
- Pydantic errors come back in the 4.4 shape with the right field codes.

### 10.5 Safety

- Idempotency: same key and body replays (one row created); same key with different body is `409`; two concurrent identical requests (threads) create one record.
- `If-Match`: each route returns `428` without it and `412` with a wrong value.
- CSRF: each write without `X-Requested-With`, with a wrong `Origin`, or with `Content-Type: text/plain` returns `403`.
- Sessions: no cookie `401`; idle expiry and absolute expiry `401`; GET does not extend idle; activity does; deactivated user is signed out; login rotates the session.
- Roles: operator gets `403 ADMIN_REQUIRED` on reversal and on parking rate or end-date changes; a test fails if any route lacks an access dependency.
- Uniqueness: active USDOT, plate, and USDOT+unit clashes; reactivation clash.
- `PARKING_STILL_ACTIVE`, `SERVICE_HISTORY_IMMUTABLE`, `INVALID_EFFECTIVE_DATE` (both statuses), `INVALID_PARKING` (both statuses, and no vehicle left behind on create).
- Billing: `412 BILLING_PREVIEW_STALE` after a parking save or a payment between preview and issue; `409 VEHICLE_PERIOD_ALREADY_BILLED` when two previews of the same period are issued.

### 10.6 End-to-end with the frontend

Run the frontend with `VITE_ENABLE_MOCKS=false` against `seed-dev` data and complete, in English and Chinese: sign in, find or add a customer, add a vehicle with a monthly amount and start date, review and issue monthly charges, record a payment, and see the new balance on the customer page, customer list, and Overview without reloading.

---

## 11. Build phases

After each phase run `ruff`, the type checker, and `pytest`, then report what ran.

| Phase | Deliver | Done when |
| --- | --- | --- |
| 1. Foundation | Project, config, `Clock`, DB engine with PRAGMAs and `BEGIN IMMEDIATE`, Alembic schema (section 5), error shape and handlers, request ID, headers, health routes | Health routes and error-shape tests pass |
| 2. Auth | Argon2, sessions, CSRF, roles, login rate limit, `must_change_password` block, CLI `create-admin`, `create-lot`, `seed-dev` | 10.5 session, CSRF, and role tests pass; frontend can sign in |
| 3. Customers | 7.2 and 7.3 except ledger; search and sort | Customer list, detail, add, edit, deactivate work from the frontend |
| 4. Vehicles and parking | 7.4 | Vehicle rules and parking rules pass; add vehicle with monthly amount works from the frontend |
| 5. Ledger and billing | `ledger/balances.py`, `GET /customers/{id}/ledger`, list balances, 7.5, 7.6, idempotency | 10.1 and 10.3 pass; review and issue monthly charges and one-time charges work from the frontend |
| 6. Payments and dashboard | 7.7, 7.8, audit events (section 8) | 10.2 passes; Overview numbers match the customer pages |
| 7. Hardening | Logging rules, backup CLI, cleanup jobs (old previews, idempotency, login failures), concurrency tests | 10.5 and 10.6 pass in full |

---

## 12. Decisions and open questions

Until the owner decides, implement the "Until decided" column (it matches what the frontend was tested against).

| # | Question | Until decided | Recommendation |
| --- | --- | --- | --- |
| 12.1 | **Decided by owner, 2026-10-31: apply each new payment to the oldest unpaid invoices automatically.** | Implement 6.5: same customer's issued invoices, oldest `due_on`, then `issued_on`, then `id`; excess remains customer credit. | Approved. Atomic allocation on recording is required, not optional. Existing credit application on monthly issue stays available. |
| 12.2 | `total_trucks` and `total_customers` include inactive records. | Include inactive, matching the mocks and the Overview label "(including inactive)". | Confirm with the owner whether "Trucks" should be active only. |
| 12.3 | Monthly rate of `$0` | Allowed (`0..999_999_999`), as the add-vehicle form offers it. Older docs said "positive rate". | Keep zero for free parking. |
| 12.4 | Sorting Chinese customer names. | `sort_key = lower(display_name)` (Unicode code point order). | Add `pypinyin` and store pinyin for Chinese names in `sort_key`. Needs dependency approval. |
| 12.5 | Overdue cut-off. | `due_on < today` in the lot time zone (changes at lot midnight). | Confirm with the owner. |
| 12.6 | `INVALID_PARKING` is `422` on create but `409` on the parking route; `INVALID_EFFECTIVE_DATE` is `422` on first save but `409` on changes. | Keep as listed; the frontend reacts to the code, not the status. | Leave as is. |
| 12.7 | Billing run issue is all or nothing. | All or nothing (one customer per run). | Keep for MVP 1. |
| 12.8 | Invoice number format. | `OL-000123`. | Keep; the UI treats it as opaque. |

Report any new mismatch between this file and the frontend by adding a dated entry to `.github/BACKEND_LOGIC_CHANGES.md` in the frontend repo.

---

## 13. Prompt for a coding agent

Paste this with this file attached:

> Build `oceanlink-api`, the Python 3.12 FastAPI + SQLite backend for OceanLink, a truck parking lot billing app, following `OCEANLINK_API_SPEC.md` exactly. The React frontend already exists and calls the 25 endpoints in section 1.1 under `/api/v1`; match the request and response shapes in section 7 field for field, use the error shape and codes in section 4, and do not invent endpoints, fields, or business rules. Money is integer cents, "today" is the lot's time zone, and every balance comes from one shared ledger module. Every money write is idempotent and runs under `BEGIN IMMEDIATE`; financial rows are append-only. Use sync route handlers, SQLAlchemy 2.0, Alembic, Pydantic v2 with `extra="forbid"` on writes, Argon2id, server-side sessions with CSRF checks, and pytest. Work phase by phase from section 11. After each phase, run ruff, the type checker, and pytest, then report what changed, what ran, and anything blocked. Where section 12 lists an open decision, implement the "Until decided" behavior and flag it.
