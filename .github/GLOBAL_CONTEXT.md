# OceanLink Global Context

Persistent project memory. Read before making changes; update when decisions change.

## Global Context

- Absolutely zero em dashes
- keep comments human readable and simple, not long and technical
- keep LLM output human readable

## Project Summary

- **Name:** OceanLink (frontend)
- **Domain:** Billing and parking management for the owners' existing truck parking lot: customers, vehicles with monthly rates, invoices, payments, balances, and reports. There is no separate parking-contract feature. Check-in/out comes in MVP 2; driver reservations and online payment come in MVP 3.
- **Users:** The parents and trusted staff (operators and admins). Customers do not have logins until MVP 3.
- **Frontend:** React + TypeScript, deployed on AWS (S3 + CloudFront)
- **Backend:** Python FastAPI with SQLite on one server (separate repo), accessed over REST/JSON
- **Requirements:** see [REQUIREMENTS.md](REQUIREMENTS.md) (version 2.0)
- **Deployment:** see [DEPLOYMENT.md](DEPLOYMENT.md)

## Domain Glossary

| Term                    | Meaning                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lot                     | The one configured truck parking facility                                                                                                                       |
| Customer                | A person or business that pays for parking. Not the same as an app user.                                                                                        |
| Vehicle                 | A truck, trailer, or attached combination. Linked to its customer by plate + jurisdiction, by USDOT number, or both.                                            |
| USDOT number            | Identifies a motor carrier (the company), not one truck. A vehicle linked only by USDOT needs a unit number.                                                    |
| Vehicle monthly parking | Monthly price, capacity category, service dates and effective-dated rate history belong to each vehicle. Customer billing defaults are copied on initial setup. |
| Capacity category       | A kind of space (for example standard, long, oversize). Monthly parking is sold by category, not by numbered bay.                                               |
| Spot                    | A physical parking space. Occupancy is derived, not stored.                                                                                                     |
| Invoice                 | A billing document: draft, issued, or void. Paid and overdue are derived.                                                                                       |
| Credit note vs refund   | A credit note reduces charges. A refund returns money. They are separate events.                                                                                |
| Parking session         | A physical stay, from check-in to check-out (MVP 2)                                                                                                             |
| Login session           | A server-side auth session identified by the session cookie                                                                                                     |
| Reservation             | A booking of capacity for a time interval (MVP 3)                                                                                                               |
| Operator / Admin        | Staff roles. Admins handle sensitive corrections, rates, config, and accounts.                                                                                  |
| Driver                  | A self-service account (MVP 3)                                                                                                                                  |

## Architecture Decisions

| Date       | Decision                                                                                                                             | Rationale                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 2026-10-20 | React + TypeScript (strict), Vite, React Router, TanStack Query, React Hook Form + Zod, MUI                                          | Common, well supported stack with no paid components               |
| 2026-10-20 | Testing with Vitest + React Testing Library; Playwright for core flows (not a deploy gate yet)                                       | Fast feedback without a heavy pipeline                             |
| 2026-10-20 | API client generated from the FastAPI OpenAPI schema                                                                                 | Keeps frontend types in sync with backend                          |
| 2026-10-20 | One lot only; the frontend loads it with `GET /lots/current`                                                                         | Keeps scope small; multi-lot features are deferred                 |
| 2026-10-20 | SQLite on one backend server; no Lambda or autoscaling                                                                               | Simple and cheap; SQLite needs a single host and a persistent disk |
| 2026-10-20 | Server-side sessions with the `__Host-session_id` cookie (HttpOnly, Secure, SameSite=Lax); 30 minute idle and 8 hour absolute limits | Easy to revoke and fits one backend                                |
| 2026-10-20 | CSRF protection with `X-Requested-With`, an `Origin` check, and content type check                                                   | Protects cookie-authenticated writes                               |
| 2026-10-20 | One browser origin: CloudFront serves the SPA from S3 and forwards `/api` to the backend                                             | First-party cookie, no CORS                                        |
| 2026-10-20 | Customers are separate from app users; customers have no logins in MVP 1 or 2                                                        | The owners bill customers who never use the app                    |
| 2026-10-20 | English and Simplified Chinese from MVP 1                                                                                            | The parents need both                                              |
| 2026-10-20 | Money is USD in integer cents; `Idempotency-Key` on financial and check-in/out writes; `If-Match` versions return `412` when stale   | Prevents duplicate or overwritten financial records                |
| 2026-10-20 | MVP 1 records offline payments only; MVP 3 uses Stripe hosted Checkout                                                               | Card data never touches OceanLink                                  |
| 2026-10-20 | One `prod` environment now; a permanent staging environment before MVP 3                                                             | Right size for a small team                                        |
| 2026-10-20 | Manual AWS setup that is documented; infrastructure as code deferred                                                                 | Avoids upfront tooling cost                                        |
| 2026-10-20 | Deploys from `main` with GitHub Actions and OIDC; `index.html` is uploaded last; no `s3 sync --delete`                               | Safe publication and easy rollback                                 |

## Conventions

- **Language:** TypeScript only; no `any` without justification.
- **Components:** Function components and hooks; one component per file; `PascalCase` files for components, `camelCase` for utilities/hooks.
- **Structure:** Feature-based folders under `src/features/`; shared code in `src/components`, `src/lib`, `src/hooks`.
- **Server state:** TanStack Query only; no duplicating API data in local/global state.
- **API access:** Only through the generated client in `src/lib/api` and the shared HTTP client; no ad hoc `fetch` in components.
- **Wire format:** `snake_case` JSON. If names are mapped to `camelCase`, do it in one place.
- **Money:** Integer cents, USD. Format amounts consistently.
- **Errors:** Handle API errors by their `code` field, not by message text.
- **Language:** No hardcoded UI text. Every string exists in English and Simplified Chinese.
- **Accessibility:** Target WCAG 2.1 AA.
- **Config:** Every `VITE_` value is public. Never put secrets or customer data in it. `VITE_API_BASE_URL` points at the same-origin `/api` path.
- **Dependencies:** Pin versions. No unbounded `latest`.
- **Testing:** Unit/component tests colocated as `*.test.tsx`; E2E in `e2e/`. Use synthetic data only.
- **Git:** Short-lived branches, conventional commit messages, PRs require passing CI. Do not deploy from a PR.

## Environments

| Env   | Frontend URL                  | Browser API base                                             |
| ----- | ----------------------------- | ------------------------------------------------------------ |
| local | `http://localhost:5173`       | `/api`, proxied by the dev server to `http://localhost:8000` |
| prod  | `https://app.<chosen-domain>` | `/api`, forwarded by CloudFront to the backend               |

One production environment for now. A permanent staging environment is required before MVP 3. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Backend Contract Notes

- FastAPI exposes OpenAPI at `/openapi.json` and docs at `/docs`.
- Base path is `/api/v1`. IDs are UUIDs. Instants are UTC ISO 8601. Business dates are `YYYY-MM-DD` in the lot's time zone.
- Errors use `{ code, message, request_id, field_errors?, details? }`. FastAPI validation errors are normalized into this shape.
- Auth: server-side sessions with the session ID in an HttpOnly cookie (REQUIREMENTS.md section 13). Authorization is enforced on the backend only.
- Mutable resources carry a `version`. Stale writes return `412`.
- Financial and check-in/out writes need an `Idempotency-Key`. A timeout is an unknown result, not a failure.
- Invoices, payments, and other financial records are never hard-deleted. Corrections use voids, credit notes, and reversals.
- `GET /customers` list items include `net_balance: { amount, currency }` and `truck_count`. The balance is outstanding invoices minus unapplied credit; the count includes active trucks and combinations, not standalone trailers. The mock enriches each paged response; production should compute these in the backend to avoid per-row requests.

## Current Status

- Frontend authentication, customer/vehicle workflows, per-vehicle monthly parking and customer account summary are implemented against development mocks. Real FastAPI integration is unverified.
- The project is split into 3 MVPs (REQUIREMENTS.md section 3).
- Current focus: MVP 1, customers, monthly vehicle parking and billing. Rates are vehicle-owned; debt and latest payment come from the customer ledger. Receipt recording/reversal and reviewed monthly-charge issuance with optional credit application are implemented against mocks. Full invoice management/PDFs, general-purpose payment allocation, refunds and real-backend integration remain unfinished.
- The overview dashboard shows six KPIs from `GET /reports/summary`: overdue and open invoice balances, unbilled parking, this-month valid payments, total customers, and total trucks. Totals include inactive records; truck count includes truck-trailer combinations but excludes standalone trailers.
- Later: MVP 2 (physical check-in/out, occupancy, walk-ins), MVP 3 (driver reservations and Stripe payments).
- Before go-live: the decisions listed in DEPLOYMENT.md section 17, a tested restore, and the desktop data cutover.

## Open Items

- Decisions required before go-live: DEPLOYMENT.md section 17.
- Documents still disagree in a few places. See the list under Known Inconsistencies below. Remove each item once it is fixed.

## Known Inconsistencies

- REQUIREMENTS.md section 16.1 requires AWS CDK and separate `dev`, `staging`, and `prod` environments. DEPLOYMENT.md has one `prod` environment and defers infrastructure as code.
- REQUIREMENTS.md section 16.4 says back up at least hourly. DEPLOYMENT.md says every 30 minutes with tiered retention. These do not conflict, but REQUIREMENTS.md should point to DEPLOYMENT.md.
- REQUIREMENTS.md sets the API base path to `/api/v1`. DEPLOYMENT.md sets `VITE_API_BASE_URL=/api`. Pick one place for the `/v1` segment.

## Change Log

- 2026-10-20: Created requirements and global context files.
- 2026-10-20: Split the project into 3 MVPs. MVP 1 is login, dashboard reporting, and add/delete users.
- 2026-10-20: Limited scope to one lot, SQLite, FastAPI, and React. Multi-lot features are marked Deferred.
- 2026-10-20: Chose server-side sessions with a session ID cookie for auth.
- 2026-10-20: Moved deployment requirements to DEPLOYMENT.md. One prod environment and one GitHub Actions workflow for now.
- 2026-10-20: Updated this file for REQUIREMENTS.md version 2.0 (billing-first MVP 1, USDOT or plate vehicle linking) and the expanded DEPLOYMENT.md. Added Known Inconsistencies.
