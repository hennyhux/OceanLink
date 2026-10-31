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
