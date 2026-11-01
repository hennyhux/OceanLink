# Backend Logic Change Log

Append a dated entry here whenever application behavior, business rules, or the frontend/backend contract changes. Include the rule before and after, effects the backend must implement, and relevant verification so this file can be handed to the backend agent.

## 2026-10-24 — Remove monthly parking capacity and category rules

- Monthly vehicle parking no longer selects or stores a capacity pool/category.
- Monthly parking no longer distinguishes vehicle types for category compatibility.
- Monthly parking saves no longer count overlapping service intervals or reject vehicles when a pool limit is reached. There is no `CAPACITY_UNAVAILABLE` failure for this workflow.
- Remove `GET /lots/current/capacity-pools` from the monthly-parking integration; the parking request/response no longer contains `pool_id` or `pool_label`.
- Preserve the remaining parking rules: one parking setup per vehicle, immutable start date after setup, end-date and rate-change permissions, effective-dated rate history, and billing behavior.
- This change applies to monthly service records only. Physical spot occupancy and future walk-in/reservation availability remain separate operational concerns.
- Verified by updating the parking UI, API model, mock handler, documentation, and parking/billing tests. The parking test now verifies that more than ten vehicles and a compact vehicle can be saved without category or capacity rejection.

## 2026-10-24 — Remove customer billing defaults; anchor charges on service start

- Remove `billing_anchor_day` and `payment_terms` from customer read/write models, customer forms, and monthly parking responses. These are no longer customer-profile settings or parking snapshots.
- Monthly parking billing periods start on the vehicle's `starts_on` date and recur monthly on that day. If a month does not contain the original day, use that month's final day and restore the original day in subsequent months when possible (for example, Jan 31 → Feb 28 → Mar 31).
- The first charge is a full monthly period beginning on `starts_on`; it is not prorated to a calendar-month boundary. Existing proration for a service end or an effective-dated rate change within a period remains.
- Invoice due dates continue to use the established rule: the service-period start date, or issue date if issued later. No due-date term is configurable on customer or vehicle parking records.
- Verified by updating customer and parking types, forms, mocks, monthly-charge calculation, docs, and tests for start-date anchoring and month-end clamping.

## 2026-10-24 - Match vehicle screens to customer layouts

- Vehicles now use the same mobile/table breakpoint as Customers (900px), compact mobile search/filter layout, full-card vehicle link, floating Add action, and primary-colored desktop table headings.
- Monthly rate is shown separately from identifiers: a centered desktop column or a mobile card footer. The owner link remains separate from the full-card vehicle link.
- Vehicle editing now uses an identity-first header with status and a matching outlined monthly-parking section. Vehicle editing, parking saves, status changes, and return-to navigation remain available on their existing routes.
- Backend impact: none. API payloads, business rules, rates, and permissions are unchanged.
- Verification: build/typecheck and targeted lint passed. Vehicle, navigation, and parking checks passed (44 tests); five existing customer-page/language assertions were excluded from the focused run. Browser checks confirmed narrow-screen layout, full-card navigation, and no page-level horizontal overflow.

## 2026-10-31 - Frontend rebuilt from scratch (UX_REBUILD.md)

The user interface was rebuilt for readability. Business rules are unchanged. The new frontend relies on these contract details; please confirm or adjust them in the backend:

- `GET /invoices` with `customer_id` and **no** `source_type` returns issued invoices from every source, newest first. Each item includes `source_type` (`manual`, `monthly_parking`, or `opening_balance`), `invoice_number`, `description` (may be null for monthly charges), `issued_on`, `due_on`, `status`, and `total: { amount, currency }`. The customer Transactions tab lists these with payments. Drafts are never returned.
- A vehicle's monthly amount may be **$0** (free parking), both in `POST /vehicles` with `parking` and in `POST /vehicles/{id}/parking`. BACKEND_REQUIREMENTS 6.5 says "positive rate"; the add-vehicle form has offered 0 since 2026-10-24. Please allow zero, or tell us to block it in the form.
- The frontend now calls `POST /auth/activity` (REQUIREMENTS 11.2) at most once a minute while staff are actively using the app, and when they choose "Stay signed in" in the idle warning. It expects the same body as `GET /auth/session` so the new idle expiry can be shown.
- The frontend warns two minutes before `idle_expires_at` and treats the session as ended at that time.
- Individuals (not only businesses) may have a USDOT number, for owner-operators. The customer form shows the field for both types.
- Money writes time out on the client after 15 seconds and are then treated as an unknown result. Retrying reuses the same `Idempotency-Key` and the same body, so the backend must replay the original result rather than reject it.
- Verification: typecheck, lint, format check, production build, and 69 tests (unit and integration through the router against the mock backend) passed. A browser check in mock mode confirmed sign in, overview, customer list, customer detail, issuing monthly charges, recording a payment, and the Overview refreshing without a reload.

## 2026-10-31 - Automatically apply new payments to oldest unpaid invoices

- Owner approved automatic allocation on payment recording. Previously, new payments remained credit until monthly charges were issued with `apply_credit`.
- `POST /payments` now allocates only the new payment to the same customer's unpaid issued invoices, oldest `due_on` first, then `issued_on`, then `id`. Include all invoice sources and invoices not yet due; skip paid, draft, void, and other-customer invoices.
- Partial payments reduce invoice balances immediately; overpayments and payments with no invoices remain unapplied credit. Existing credit application during monthly issue remains available.
- The backend must commit payment creation, allocations, audit events, and the idempotency record atomically. Allocations record the actual staff actor and invoice number and bump the payment version. Same-key retries must not duplicate allocations; reversals must release them.
- Updated OCEANLINK_API_SPEC.md, BACKEND_REQUIREMENTS.md, REQUIREMENTS.md, and the frontend mocks. The real FastAPI backend is not in this repository.
- Verification: 27 targeted allocation, financial UI, and Overview tests passed, including partial payments, overpayments, FIFO tie-breakers, same-key replays, reversals, inactive customers, stale previews, and existing-credit application. Typecheck, targeted ESLint and Prettier checks, and the production build passed.

## 2026-10-31 - Dashboard global search

- Overview searches customers, vehicles, and payments using the existing list APIs with `q` and `page_size=5`. Customer and vehicle requests also send `include_inactive=true`; payments include received and reversed records.
- Each API must filter before pagination and return the true filtered `total`. The UI displays separate result groups, links to full filtered lists, and opens payment receipts through `GET /payments/{id}`.
- No new endpoint or request/response field is required. Existing search matching rules remain unchanged.
- UX refinement (same day): results now render as one panel with a match summary, filter buttons (All, Customers, Vehicles, Payments with counts), and only the groups that have matches. Rows are full-width tap targets with the matched text highlighted; the dashboard cards hide while a search is active and return on clear. Enter searches at once (phone keyboards show a Search key), Escape clears, and `/` focuses the box. No backend change. Verification: 28 targeted tests (search, Overview, locale consistency, financial flows) plus 39 list-page and shell tests passed; typecheck, ESLint, Prettier, and the production build passed; browser checks at desktop and phone widths in English and Chinese.

## 2026-10-31 - Overview dashboard redesign

The Overview page was redesigned from the owner's sketch. It uses only existing endpoints, so nothing is required of the backend right now. These additions would make it faster and remove client-side limits:

- `GET /reports/summary` could add `overdue_customer_count`, `active_customer_count`, `payments_received_this_month_count`, and `vehicles_with_monthly_parking` (service covering today in the lot time zone). Today the frontend gets these from list `total` values, or by scanning up to 100 vehicles.
- `GET /customers` items could add `oldest_overdue_on` (business date) so the dashboard can show "14 days overdue". The frontend does not show days overdue until this exists.
- A staff-readable `GET /activity?limit=` (or a staff view of `/audit-events`) returning `{ kind, at, customer_id, customer_name, vehicle_id?, amount? }` would replace the recent-activity feed the frontend builds from payments, vehicles, and customers.
- "Needs attention" counts (monthly parking ending within 30 days, active customers with no phone or email, active vehicles without monthly parking) are computed in the browser from the first 100 records. A `GET /reports/attention` endpoint returning those counts would make them exact for larger lots.
- Verification: typecheck, lint, and 77 tests passed, including dashboard tests for each card, a failed-summary case (other cards still load and no $0.00 is shown), Chinese text, and unit tests for the attention and activity rules. A browser check in mock mode confirmed the four-across layout at laptop width with no sideways scrolling.
