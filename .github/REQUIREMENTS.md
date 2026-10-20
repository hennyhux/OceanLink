**OceanLink Frontend Requirements**

**Version:** 2.0  

**Current simplification:** Monthly parking belongs directly to each vehicle. There is no separate parking-contract entity, approval screen or shared contract price. Customer billing defaults apply to new vehicle parking setups; existing setup snapshots and issued invoices do not change when defaults are edited.
**Primary users:** The owners and staff of the family’s truck parking lot.  
**Requirement statuses:** `Planned` | `In Progress` | `Done` | `Deferred`

This document replaces the previous requirements. All implementation requirements are initially `Planned` unless explicitly marked `Deferred`.

**1. Purpose and scope**

OceanLink helps the owners run their existing truck parking business.

The first release must let them answer:

- Who are our customers?
- Which trucks and trailers belong to each customer?
- Which vehicles have monthly parking, and at what rates?
- What should each customer be charged?
- Which invoices have been issued?
- What payments have been received?
- Who still owes money, and how overdue is it?
- Can we print an invoice or account statement for a customer?

Driver reservations and online payment are introduced in MVP 3.

This repository contains the React frontend. Backend implementation, database migrations, payment processing, and API infrastructure remain in a separate backend project.

The business rules and API behaviors in this document are shared requirements. A frontend release is not operationally complete until its backend dependencies are available and tested.

**1.1 Initial constraints**

- One parking lot.
- USD only.
- React with TypeScript.
- Python FastAPI backend over REST.
- SQLite on persistent local storage attached to one backend server.
- English and Simplified Chinese available from MVP 1.
- Customers do not need application accounts in MVP 1 or MVP 2.
- No public reservation interface before MVP 3.
- No external queue, cache, or real-time messaging service is required.
- No multi-lot management, lot search, or map-based browsing.

The lot’s real name, address, time zone, capacity, invoice details, and prices are entered during setup. They must not be invented or hardcoded from example data.

**1.2 Operating defaults**

These defaults make implementation concrete. Actual customer agreements and existing balances must be preserved during migration.

| Area                               | Default                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Parking sold to monthly customers  | A space in a capacity category, without a guaranteed numbered bay          |
| Capacity consumption               | One parked unit consumes one space                                         |
| Tractor and attached trailer       | One unit when parked together                                              |
| Detached trailer parked separately | A separate unit and vehicle record                                         |
| Monthly billing                    | Recurring monthly periods with a configurable billing anchor day           |
| Default billing anchor             | First day of the month                                                     |
| Default invoice due date           | Start of the service period, or issue date if issued later                 |
| Partial monthly periods            | Prorated by calendar days in the relevant billing period                   |
| Automatic late fees                | Disabled; staff may add a documented charge                                |
| Payment allocation                 | Staff reviews allocations; the UI may suggest oldest unpaid invoices first |
| Physical spot selection by drivers | Deferred; reservations select a capacity category                          |
| Complex pricing rules              | Deferred; use vehicle-specific monthly rates and flat hourly rates       |

Changing a default must not silently change an issued invoice or an existing agreed price.

**2. Users, customers, and permissions**

An application user and a paying customer are separate entities.

A trucking company can be a customer with multiple vehicles and invoices without having an application login.

| Entity or role | Purpose                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| Customer       | Individual or business responsible for parking charges                                        |
| Vehicle        | Truck, trailer, or attached combination associated with a customer                            |
| Operator       | Staff member handling routine customer, billing, and parking work                             |
| Admin          | Owner or authorized staff member who manages access, configuration, and sensitive corrections |
| Driver         | Self-service account introduced in MVP 3                                                      |

**2.1 Staff permissions**

| Action                                                                        | Operator | Admin |
| ----------------------------------------------------------------------------- | -------: | ----: |
| View customers, vehicles, monthly rates, invoices, balances, and reports         |      Yes |   Yes |
| Create and edit routine customer and vehicle information                      |      Yes |   Yes |
| Set up vehicle monthly parking and prepare invoices                                        |      Yes |   Yes |
| Save a vehicle parking setup within available capacity                               |      Yes |   Yes |
| Issue invoices                                                                |      Yes |   Yes |
| Record an offline payment and allocate it                                     |      Yes |   Yes |
| Check vehicles in and out, starting in MVP 2                                  |      Yes |   Yes |
| Void an issued invoice, issue a credit, reverse a payment, or record a refund |       No |   Yes |
| Schedule future changes to existing vehicle monthly rates                           |       No |   Yes |
| Change lot capacity or pricing configuration                                  |       No |   Yes |
| Manage staff accounts and roles                                               |       No |   Yes |
| Commit a migration or opening-balance import                                  |       No |   Yes |
| View the complete audit log                                                   |       No |   Yes |

Changing an existing vehicle service end date requires an admin. Credits, refunds and financial corrections remain separate audited workflows.

Both staff roles initially operate the single configured lot. There is no operator-to-lot assignment interface.

**2.2 Driver permissions**

MVP 3 driver accounts can access only their own customer records, vehicles, reservations, associated invoices, payments, and notifications.

New driver registration creates an individual customer account.

Existing business customers are not automatically linked by matching a phone number, email address, or license plate. Shared fleet portals and multiple driver accounts accessing one company’s full billing history are deferred.

Any supported link to an existing customer requires an explicit admin workflow that verifies the relationship.

All permissions and ownership checks must be enforced by the backend. Hiding buttons or routes is not an authorization control.

**3. Release plan**

Each MVP is a production-capable release with its own acceptance criteria. Development and staging deployment alone do not mean an MVP is complete.

| Release | Primary outcome                                           | Main users                | Status  |
| ------- | --------------------------------------------------------- | ------------------------- | ------- |
| MVP 1   | Run monthly customer billing and track what customers owe | Parents and trusted staff | Planned |
| MVP 2   | Record actual parking activity and handle walk-ins        | Parents and lot operators | Planned |
| MVP 3   | Let drivers reserve and pay online                        | Drivers and staff         | Planned |

Accessibility, authorization, error handling, auditability, and appropriate automated tests apply to every release.

**4. MVP 1: Customers, monthly parking, and billing**

**Goal:** The parents can manage their existing customers and monthly parking business without maintaining a separate spreadsheet for current invoices and balances.

**4.1 Required workflows**

| ID    | Requirement                                                                          | Role                       | Status  |
| ----- | ------------------------------------------------------------------------------------ | -------------------------- | ------- |
| M1-01 | Sign in, sign out, change password, and recover staff access                         | Staff                      | Planned |
| M1-02 | Add, edit, search (including by USDOT number), and deactivate customers              | Staff                      | Planned |
| M1-03 | Add, edit, search, and archive vehicle records, each linked by plate or USDOT number | Staff                      | Planned |
| M1-04 | Associate multiple vehicles with one customer                                        | Staff                      | Planned |
| M1-05 | Set per-vehicle monthly rates, category and service dates; preserve effective-dated rate history | Staff, with admin controls | Planned |
| M1-06 | Preview recurring charges and issue monthly invoices                                 | Staff                      | Planned |
| M1-07 | Download and print invoices and customer statements                                  | Staff                      | Planned |
| M1-08 | Record cash, check, bank transfer, and externally collected payments                 | Staff                      | Planned |
| M1-09 | Allocate partial or full payments to invoices                                        | Staff                      | Planned |
| M1-10 | Show outstanding balances, unapplied credit, and overdue invoices                    | Staff                      | Planned |
| M1-11 | Record credits, payment corrections, and offline refunds                             | Admin                      | Planned |
| M1-12 | Show customer, monthly parking, billing, and collections summaries                         | Staff                      | Planned |
| M1-13 | Import existing customers, vehicles, parking rates and opening balances                | Admin                      | Planned |
| M1-14 | Export business records to CSV                                                       | Staff                      | Planned |
| M1-15 | Manage staff accounts, roles, and active status                                      | Admin                      | Planned |
| M1-16 | Switch the interface between English and Simplified Chinese                          | Staff                      | Planned |
| M1-17 | Record audit events for financial and access changes                                 | Backend dependency         | Planned |

**4.2 Main navigation**

- Overview
- Customers
- Vehicles
- Invoices
- Payments
- Reports
- Settings

Customer details must bring together contact information, vehicles and their monthly rates, invoices, payments, and account history. They show amount owed, overdue invoices, available credit, and the latest valid payment amount, effective date and method.

The common workflow should be easy to complete:

1. Find or add the customer.
2. Add their vehicle.
3. Set the vehicle's monthly rate, category and service dates.
4. Preview and issue the invoice.
5. Print or download the invoice.
6. Record payment.
7. See the remaining balance.

**4.3 Dashboard**

MVP 1 shows:

- Active customers.
- Vehicles with currently effective monthly parking.
- Monthly parking capacity committed.
- Unpaid invoice balance.
- Overdue invoice balance.
- Gross payments received during the selected period.
- Refunds during the selected period.
- Net cash collected during the selected period.
- Invoices awaiting review or issuance.

MVP 1 must not label monthly-parking vehicles as physically present.

Physical occupancy and live check-in information are introduced in MVP 2.

**4.4 Language and usability**

- English and Simplified Chinese are required at launch.
- The language selector must be visible and persistent.
- UI labels, validation messages, empty states, and application errors must be translated.
- Customer names and notes remain as entered.
- Search must support Chinese names and English names.
- Invoice and statement PDFs must render Chinese characters correctly.
- Financial amounts use USD formatting consistently.
- Common actions must work on a laptop and tablet without horizontal page scrolling.

**4.5 Out of scope**

- Driver accounts.
- Public registration.
- Online reservations.
- Online payment collection.
- Physical check-in/out.
- Live occupancy.
- Automatic late-fee calculation.
- Electronic contract signatures.
- General-ledger accounting or tax filing.

**5. MVP 2: Physical parking operations**

**Goal:** Staff can record which vehicles are actually present and handle temporary parking without losing the billing history established in MVP 1.

**5.1 Required workflows**

- Manage physical spots and capacity categories.
- Check monthly customers in and out.
- Check walk-in customers in and out.
- Record the vehicle, payer, capacity category, and expected departure for a walk-in.
- Assign an available compatible physical spot at check-in.
- Display physical occupancy and operational exceptions.
- Search active sessions by customer, vehicle identifier, plate and jurisdiction, or USDOT number.
- Calculate temporary-parking charges using the rate captured at check-in.
- Create an invoice for a walk-in.
- Record offline payment using the MVP 1 payment workflow.
- Identify vehicles that remain after their expected departure.
- Refresh occupancy through polling every 15 seconds.

A walk-in must have a customer record identifying the payer. A customer login is not required.

**5.2 Monthly customers**

Checking in a vehicle with effective monthly parking uses the capacity already committed by that vehicle's parking setup.

It must not consume a second unit of contractual capacity.

Checking out the vehicle removes its physical presence. It does not release its monthly parking entitlement.

An overdue balance does not automatically end monthly parking or record a vehicle as departed. Staff must use an explicit authorized workflow.

**5.3 Out of scope**

- Public reservations.
- Driver accounts.
- Online payment processing.
- WebSocket or SSE infrastructure.
- Complex weekday or time-of-day pricing.

**6. MVP 3: Driver reservations and online payment**

**Goal:** Drivers can view the lot, reserve compatible capacity, pay online, and manage their bookings.

**6.1 Required workflows**

- View public lot details and interval-based availability before signing in.
- Register, verify email, sign in, and reset a password.
- Maintain an individual customer profile and vehicle records.
- Request a price quote.
- Create a temporary reservation hold.
- Complete payment through Stripe hosted Checkout.
- View reservation and payment status.
- Modify or cancel a reservation under the defined rules.
- View invoices, receipts, and refund status.
- Receive in-app reservation notifications and transactional emails.
- Allow staff to view and manage reservations from the operations interface.

Online payments are required for this release. They are not optional scope.

**6.2 Notifications**

MVP 3 includes:

- Reservation confirmation.
- Reservation cancellation.
- Payment receipt.
- Refund pending, completed, or failed.
- Staff alerts for overstays and capacity exceptions.

Password reset and email verification are required delivery workflows.

SMS, push notifications, promotional email, and marketing automation are deferred.

Notification delivery uses an email provider such as Amazon SES. Its setup is a backend/infrastructure dependency for MVP 3.

**7. Shared business rules**

**7.1 Vehicles and identification**

- Each vehicle belongs to a customer.
- A customer may have multiple vehicles.
- Every vehicle must be linked by at least one of:
  - **Plate:** plate number plus issuing jurisdiction.
  - **USDOT number:** the carrier number marked on the truck.
- A vehicle may have both.
- Reject a vehicle record that has neither.
- An internal unit number may also be recorded.

**Plate rules**

- Store the plate number and issuing jurisdiction separately.
- Normalize plate numbers on the server and client for matching.
- Preserve a display value when normalization removes formatting.
- Do not treat a plate number alone as globally unique.
- Prevent duplicate active vehicles with the same normalized plate and jurisdiction.

**USDOT rules**

- A USDOT number identifies a motor carrier, not a single truck. Many trucks can share one USDOT number.
- A vehicle linked only by USDOT must have a unit number. The unit number must be unique among active vehicles with the same USDOT number.
- Store the USDOT number as digits only (no letters or spaces). Show validation if the format is invalid.
- A business customer may have a USDOT number. It must be unique among active customers.
- A new vehicle defaults to its customer’s USDOT number. Staff may change it, for example for a leased truck that runs under another carrier.
- Warn staff when a vehicle’s USDOT number differs from its customer’s.
- Searching by USDOT number returns all matching customers and vehicles. Staff must pick the specific unit for check-in or billing.
- Looking up a USDOT number with an external government service is deferred. Staff enter it manually.

**History**

- Historical invoices and sessions retain their identifying snapshots (plate, jurisdiction, USDOT number, and unit number) after a vehicle record is edited.

A vehicle with an active session cannot be archived or transferred through an ordinary edit.

Ownership transfers must preserve historical customer relationships.

**7.2 Vehicle monthly parking**

The customer is the payer; each vehicle has its own optional monthly parking setup. No separate contract or approval entity is required.

A parking setup stores the capacity category, billing start date, optional exclusive service end date, monthly USD rate, copied billing day and payment terms, and effective-dated rate history. Each vehicle consumes one unit of compatible capacity for its full service interval, even while absent.

Customer defaults are billing day 1 and payment due at the start of the service period unless staff records different terms. Defaults are copied when parking is first saved; later customer edits do not change an existing setup.

Saving the setup checks vehicle/customer active status, category compatibility and interval capacity atomically. Existing service starts and category cannot be rewritten through ordinary edits. Admin-only rate changes append history with a future effective date and reason; they do not overwrite old rates or issued invoices.

Business dates have an inclusive start and exclusive end. Service through October 31 ends on November 1. Checking out a vehicle does not end monthly service. An admin reviews changes to an existing service end date and handles credits/refunds separately. Archive only after monthly service has ended; preserve its rate history.

The vehicle rate is not the customer balance. Debt is derived from issued invoices, allocations and credits. One customer invoice can contain several vehicle charge lines.

**7.3 Billing periods and proration**

- Billing anchor days may be 1 through 31.
- If a month lacks the anchor day, use that month’s final day.
- Calculate each boundary from the original anchor so a February adjustment does not permanently shift later billing dates.
- The first and final partial periods are prorated by calendar days in the applicable full billing period.
- Use decimal arithmetic on the backend.
- Round the final prorated line amount to cents using a documented, consistent rounding rule.
- Display the service dates and proration explanation before issuance.

Example: a $300 monthly rate covering 15 of 30 days produces a $150 charge.

Vehicle rate changes apply prospectively from an explicit future effective date. Existing issued invoice lines are not recalculated; billing must split and prorate periods where applicable.

A correction affecting an already issued period requires an explicit debit or credit adjustment.

**7.4 Invoice generation**

MVP 1 uses a staff-initiated billing run:

1. Select the billing period or billing-through date.
2. Generate a preview of charges due.
3. Show vehicle parking periods skipped, already billed, or requiring attention.
4. Review the selected invoices.
5. Issue them.
6. Download or print them.

Invoices may combine multiple vehicles for the same customer when their due dates match. Each line retains its own vehicle and service period.

A recurring charge is uniquely identified by its vehicle, service period, rate version, and charge type. There is no contract reference.

Repeating a billing run must not issue the same recurring charge twice.

Any explicit replacement of a voided charge must reference the superseded record.

**7.5 Invoice lifecycle**

Invoice document statuses are:

`draft | issued | void`

Payment state is derived separately:

`unpaid | partially_paid | paid`

Overdue is also derived separately from the due date and remaining balance.

Rules:

- Drafts may be edited.
- Drafts do not contribute to receivables.
- Issuance assigns a unique human-readable invoice number.
- Issued customer details, line descriptions, prices, periods, and totals are historical snapshots.
- Issued invoices cannot be silently edited or deleted.
- Corrections use void-and-replace or credit notes.
- An invoice with allocated payments cannot be voided until those allocations are resolved through an authorized workflow.
- Voided invoices remain visible in history and contribute no active receivable.
- A fully credited invoice has no remaining amount due.

Every invoice identifies the paying customer.

Invoice lines may originate from a vehicle's monthly parking, walk-in, reservation, manual charge, or opening balance. A reservation is not required.

**7.6 Payments, credits, and balances**

MVP 1 records money received outside OceanLink. It does not charge a card or move funds.

Supported recorded methods:

`cash | check | bank_transfer | external_card | other`

A payment includes its customer, amount, effective date, method, reference, and recording staff member.

- Payments may be allocated across multiple invoices belonging to the same customer.
- Partial payments are supported.
- Allocations cannot exceed the payment’s available amount.
- Allocations cannot exceed an invoice’s remaining collectible balance.
- Overpayments remain as unapplied customer credit.
- Applying existing credit must not create a second cash receipt.

A credit note reduces charges. A refund records or initiates a return of money. They are separate events.

If a credit reduces an invoice below the amount already allocated, the excess allocation is released to customer credit atomically.

An offline refund records money that staff has already returned outside the application. A provider refund in MVP 3 initiates a provider operation and has its own processing status.

Payment reversals correct erroneous payment records. They do not represent an actual refund.

Financial corrections require an admin, a reason, and an audit event.

Customer net balance is:

**Outstanding issued invoice balances minus unapplied customer credit.**

A positive net balance means the customer owes money. A negative balance means the customer has credit.

**7.7 Capacity and physical occupancy**

Capacity is managed in categories, such as standard, long, and oversize.

The initial setup may use one category if that matches the actual lot. Adding categories must reflect real space and vehicle constraints.

There is no automatic substitution between categories in the initial releases.

Physical spot records exist from initial setup so capacity has one authoritative source. The full spot-management interface arrives in MVP 2.

Separate these concepts:

| Concept               | Meaning                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| Physical capacity     | Non-retired physical spots                                              |
| Operational capacity  | Spots currently enabled for use                                         |
| Physical occupancy    | Spots containing an active parking session                              |
| Monthly committed capacity | Capacity committed to saved vehicle monthly parking setups                       |
| Temporary commitments | Capacity held by walk-ins, reservation holds, or confirmed reservations |
| Bookable capacity     | Capacity remaining throughout a requested interval                      |

A vehicle monthly parking setup consumes one unit in its category throughout its effective term, even when that vehicle is absent.

A monthly customer’s active parking session references that existing commitment. It must not be counted twice.

A walk-in or reservation creates a temporary commitment.

Availability is evaluated for the entire requested interval. A positive count at the start of the interval is insufficient.

All time-based reservations use half-open intervals: `[starts_at, ends_at)`.

**7.8 Spot condition**

Writable spot condition is:

`enabled | disabled | retired`

Physical occupancy is derived from active sessions.

Reservation commitments are managed separately. A spot does not have a writable `reserved` or `occupied` status.

Ordinary spot disabling or retirement must not:

- Silently remove an active vehicle.
- Reduce capacity below existing commitments.
- Delete historical sessions.

An admin may record an emergency outage with a reason. The system must surface affected commitments and block new sales that cannot be honored. It must not silently cancel existing customers.

**7.9 Check-in and checkout**

Check-in requires:

- Customer.
- Vehicle.
- Compatible capacity category.
- Available physical spot.
- Vehicle monthly parking, reservation, or walk-in context.
- Expected departure for a walk-in.

The backend prevents:

- Two active sessions for one vehicle.
- Two vehicles occupying the same spot.
- Check-in against an incompatible or unavailable commitment.

Checkout:

- Ends the physical session.
- Completes an associated active reservation when applicable.
- Calculates any additional charges.
- Creates or references the appropriate invoice.
- Returns the outstanding financial balance.

Checkout does not imply payment.

A vehicle remains physically present until a successful checkout is recorded. Passing an expected departure time must not automatically free its physical spot.

An overstay creates an exception, consumes actual occupancy, and may affect future commitments. The UI must expose that conflict for staff resolution.

**7.10 Temporary-parking pricing**

MVP 2 and MVP 3 use one published hourly rate per category.

- Minimum charge: one hour.
- Additional partial hours round up to a whole hour.
- No daily cap unless explicitly added through a later approved requirement.
- Default overstay billing grace: zero minutes.
- The applicable rate is captured when the walk-in begins or the reservation price is accepted.
- Later price changes do not rewrite historical vehicle rates, visits, reservations or issued invoices.
- Early arrival requires staff to verify and authorize any additional capacity interval.
- Early departure does not automatically refund a prepaid reservation.
- Additional overstay charges create an additional invoice or invoice line in an appropriate new document; they do not rewrite an already issued paid invoice.

Complex pricing precedence, weekday rules, and overnight rate windows are deferred.

**8. Reservation and payment lifecycle for MVP 3**

**8.1 Reservation states**

`pending_payment | confirmed | active | completed | cancelled | expired | no_show`

| Event                                                  | Result            |
| ------------------------------------------------------ | ----------------- |
| Accept a valid quote and successfully obtain capacity  | `pending_payment` |
| Backend verifies payment while the hold remains valid  | `confirmed`       |
| Authorized check-in                                    | `active`          |
| Successful checkout                                    | `completed`       |
| Allowed cancellation                                   | `cancelled`       |
| Unpaid hold reaches its expiration time                | `expired`         |
| Confirmed customer misses the defined arrival deadline | `no_show`         |

States cannot be changed through an unrestricted `PATCH status`.

**8.2 Quotes and holds**

- Quotes expire after five minutes.
- A quote identifies the category, interval, price breakdown, rate version, and expiration time.
- A quote does not reserve capacity.
- Creating a reservation from a quote atomically checks capacity and creates a ten-minute payment hold.
- Pending holds consume capacity.
- Expiration uses server time.
- A browser refresh or server restart does not extend a hold.
- Payment failure permits retry within the remaining hold period.

If capacity or an accepted quote is no longer valid, the backend returns a specific conflict code and the frontend requests a new quote.

**8.3 Online payment**

Use provider-hosted payment collection. Card details must not pass through OceanLink forms, logs, or storage.

- The backend creates the checkout operation.
- The frontend redirects to the provider or follows the provider-supported return flow.
- Returning to the app does not prove payment succeeded.
- The frontend reads the backend’s payment status.
- Signed provider webhooks are the primary completion signal.
- The backend also supports reconciliation for missing or delayed events.
- Duplicate and out-of-order events must not create duplicate financial records.

Possible UI states include:

`awaiting_payment | requires_action | processing | succeeded | failed | cancelled`

If payment succeeds after a hold has expired or the reservation has been cancelled:

- Do not recreate or confirm the reservation automatically.
- Record the received funds.
- Initiate a refund.
- Display the refund status.
- Alert staff if automatic refund processing fails.

Successful confirmation, invoice issuance, and payment allocation must be reconciled as one coherent application workflow.

**8.4 Cancellation**

Initial policy:

- Drivers may cancel before the scheduled start.
- Cancellation releases the commitment immediately.
- Eligible prepaid booking charges receive a full refund.
- Refund completion is tracked separately from reservation cancellation.
- Driver cancellation after the scheduled start is unavailable.
- Staff may handle exceptions using an audited administrative workflow.
- Active parking sessions must be checked out rather than cancelled.

The cancellation policy must be visible before checkout.

**8.5 No-shows**

A confirmed reservation becomes a no-show if the driver has not checked in within 30 minutes after its scheduled start, unless staff has recorded an approved arrival extension.

- Release its unused commitment.
- Do not automatically issue a refund under the initial policy.
- Preserve the reservation and financial history.
- Show the policy before purchase.

**8.6 Modification**

A driver may request changes before the reservation starts.

- Obtain a modification quote.
- Keep the original confirmed reservation valid while the change is pending.
- Hold only the additional capacity required by the proposed change.
- For a price increase, collect the difference before committing the change.
- For a price decrease, commit the valid change and create the appropriate credit and refund.
- If payment or capacity acquisition fails, retain the original reservation.
- Expire abandoned modification holds.
- Refund a late modification payment if the change can no longer be committed.
- Allow only one pending modification per reservation version.

Modification and cancellation must use version checks to prevent concurrent actions from overwriting each other.

**9. Reporting definitions**

Use precise labels instead of a generic “revenue” metric.

| Metric                         | Definition                                                            |
| ------------------------------ | --------------------------------------------------------------------- |
| Gross collections              | Valid received payments with effective dates in the selected interval |
| Refunds                        | Successful refunds with effective dates in the selected interval      |
| Net cash collected             | Gross collections minus refunds                                       |
| Outstanding receivables        | Remaining balances on issued, non-void invoices                       |
| Overdue receivables            | Outstanding balances whose due date is before the selected as-of date |
| Customer credit                | Unapplied valid funds and opening-credit adjustments                  |
| Vehicles with monthly parking | Vehicle service intervals covering the lot's current local date             |
| Physical occupancy             | Vehicles with active parking sessions at the reported instant         |
| Monthly committed capacity     | Capacity committed by effective vehicle monthly parking                    |
| Bookable capacity              | Minimum remaining compatible capacity across the requested interval   |

Credit notes do not count as cash refunds.

Invoice issuance does not count as cash collection.

Receivables reports use an explicit as-of date. Collections reports use a date range.

Current occupancy remains a current snapshot even when a collections date filter changes. Each widget must display its applicable date or time context.

Overdue aging buckets are:

- 1–30 days.
- 31–60 days.
- 61–90 days.
- More than 90 days.

**10. Core API models**

All mutable resources include a `version` used for concurrency checks.

| Model             | Required information                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User              | ID, email, name, role, active status, preferred language, password-change requirement                                                                                                        |
| Customer          | ID, individual/business type, display name, optional USDOT number, contact details, billing address, active status                                                                           |
| Vehicle           | ID, customer ID, unit number, vehicle type, plate and jurisdiction (optional), USDOT number (optional), capacity category, active status. At least one of plate or USDOT number is required. |
| Lot               | ID, name, address, time zone, currency, derived capacity summaries                                                                                                                           |
| CapacityPool      | ID, lot ID, label/category, compatibility rules, derived capacity                                                                                                                            |
| Spot              | ID, pool ID, label, condition; occupancy is a computed view                                                                                                                                  |
| Vehicle parking fields | Vehicle-owned category, service dates, monthly rate, copied billing day/terms and effective-dated rate history. No separate contract entity. |
| Invoice           | ID, invoice number, customer snapshot, document status, issue date, due date, lines, totals, derived payment state and balance                                                               |
| InvoiceLine       | Description, amount, vehicle snapshot when applicable, service period, source type and source ID                                                                                             |
| Payment           | ID, customer, amount, effective date, method, reference, status, recorded-by information                                                                                                     |
| PaymentAllocation | Payment ID, invoice ID, amount, allocation and reversal history                                                                                                                              |
| CreditNote        | ID, invoice ID, amount/lines, reason, issue date, actor                                                                                                                                      |
| Refund            | ID, original payment, amount, method, processing status, reason                                                                                                                              |
| LedgerEntry       | ID, customer, event type, effective date, amount, source reference, actor                                                                                                                    |
| ParkingSession    | ID, customer, vehicle, spot, commitment reference, check-in, expected departure, checkout, pricing snapshot                                                                                  |
| Quote             | ID, requested service, interval, category, total, breakdown, pricing version, expiration                                                                                                     |
| Reservation       | ID, customer, vehicle, pool, interval, state, accepted pricing, hold expiration, version                                                                                                     |
| PaymentAttempt    | ID, reservation or modification reference, provider reference, amount, state                                                                                                                 |
| Notification      | ID, recipient, type, related resource, message key/data, read state, creation time                                                                                                           |
| AuditEvent        | Actor, action, resource, relevant before/after values, reason, timestamp, request ID                                                                                                         |

Financial records are not deleted through ordinary CRUD endpoints.

Historical financial and operational views use their recorded snapshots rather than current customer names or current prices where that would change the meaning of the original record.

**11. API conventions and endpoints**

**11.1 Conventions**

- Base path: `/api/v1`.
- UUID resource identifiers.
- `snake_case` JSON fields.
- UTC ISO 8601 timestamps for instants.
- `YYYY-MM-DD` for business dates interpreted in the lot’s configured time zone.
- Money uses integer minor units and `currency: "USD"`.
- JSON is the default request and response format.
- CSV imports use a documented multipart upload.
- PDF and CSV downloads return their appropriate content types.
- Lists use `page`, `page_size`, and deterministic sorting.
- Default page size: 20; maximum: 100.
- Paged responses contain `items`, `page`, `page_size`, and `total`.

The frontend obtains the configured lot through `GET /lots/current`.

Zero configured lots or an invalid multiple-lot setup produces an explicit setup error. The frontend must not silently select the first result.

Write schemas must list allowed fields. Read-only totals, ownership fields, historical snapshots, and derived states cannot be changed through broad “partial model” requests.

**11.2 Authentication and staff administration**

| Method     | Path                               | Access        | Purpose                                    |
| ---------- | ---------------------------------- | ------------- | ------------------------------------------ |
| POST       | `/auth/login`                      | Public        | Authenticate and create a session          |
| POST       | `/auth/logout`                     | Authenticated | Revoke the current session                 |
| GET        | `/auth/session`                    | Authenticated | Return user and session expiration context |
| POST       | `/auth/activity`                   | Authenticated | Report actual user interaction             |
| POST       | `/auth/change-password`            | Authenticated | Change password under the password policy  |
| PATCH      | `/users/me`                        | Authenticated | Update allowed profile fields and language |
| GET / POST | `/admin/users`                     | Admin         | List or create staff accounts              |
| PATCH      | `/admin/users/{id}`                | Admin         | Edit name, role, and active status         |
| POST       | `/admin/users/{id}/reset-password` | Admin         | Issue a temporary recovery credential      |

No staff hard-delete endpoint is included in the initial releases.

The first admin is created through a documented backend bootstrap procedure.

Admin-created temporary credentials require a password change before access to business data. A backend recovery procedure must exist if all administrators lose access.

**11.3 Customers, vehicles, and monthly parking**

| Method      | Path                            | Access      | Purpose                                        |
| ----------- | ------------------------------- | ----------- | ---------------------------------------------- |
| GET         | `/lots/current`                 | Staff       | Load the configured lot                        |
| PATCH       | `/lots/{id}`                    | Admin       | Edit permitted lot details                     |
| GET / POST  | `/customers`                    | Staff       | Search customers or create one                 |
| GET / PATCH | `/customers/{id}`               | Staff       | View or edit allowed customer fields           |
| GET         | `/customers/{id}/ledger`        | Staff       | Read account history and balances              |
| GET         | `/customers/{id}/statement.pdf` | Staff       | Download account statement                     |
| GET / POST  | `/vehicles`                     | Staff       | Search or create vehicles                      |
| GET / PATCH | `/vehicles/{id}`                | Staff       | View or edit allowed vehicle fields            |
| GET | `/lots/current/capacity-pools` | Staff | Read configured compatible capacity categories |
| POST | `/vehicles/{id}/parking` | Staff initially; Admin for rate/end changes | Save monthly parking or append a prospective rate change with `If-Match`; return the updated vehicle |

Archiving is implemented through explicit active-status fields and server-side preconditions.

Archiving a customer does not remove their balance or prevent staff from collecting existing debt.

**11.4 Billing and payments**

| Method      | Path                          | Access                | Purpose                                                          |
| ----------- | ----------------------------- | --------------------- | ---------------------------------------------------------------- |
| POST        | `/billing-runs/preview`       | Staff                 | Produce a reviewable billing proposal                            |
| GET         | `/billing-runs/{id}`          | Staff                 | Read the proposal and current results                            |
| POST        | `/billing-runs/{id}/issue`    | Staff                 | Issue the selected valid invoices                                |
| GET / POST  | `/invoices`                   | Staff                 | List invoices or create a draft                                  |
| GET / PATCH | `/invoices/{id}`              | Staff                 | Read an invoice or edit a draft                                  |
| POST        | `/invoices/{id}/issue`        | Staff                 | Issue a draft                                                    |
| POST        | `/invoices/{id}/void`         | Admin                 | Void under the correction rules                                  |
| GET         | `/invoices/{id}/pdf`          | Staff; owner in MVP 3 | Download invoice                                                 |
| POST        | `/invoices/{id}/credit-notes` | Admin                 | Issue a credit                                                   |
| GET / POST  | `/payments`                   | Staff                 | List payments or record an offline receipt                       |
| GET         | `/payments/{id}`              | Staff                 | Read payment and allocation history                              |
| POST        | `/payments/{id}/allocate`     | Staff                 | Apply a reviewed allocation plan                                 |
| POST        | `/payments/{id}/reverse`      | Admin                 | Correct an erroneous receipt                                     |
| POST        | `/payments/{id}/refunds`      | Admin                 | Record an offline refund or initiate a supported provider refund |

Billing proposals capture the vehicle parking and rate versions used to calculate their charges.

If vehicle parking or a relevant rate changes before issuance, affected items must be rejected for refresh rather than issued using an undisclosed different amount.

A billing run exposes per-invoice outcomes. Retries must not reissue successful items.

**11.5 Reports, migration, and audit**

| Method | Path                   | Access | Purpose                                              |
| ------ | ---------------------- | ------ | ---------------------------------------------------- |
| GET    | `/reports/summary`     | Staff  | Read defined dashboard metrics                       |
| GET    | `/reports/collections` | Staff  | Read gross collections, refunds, and net collections |
| GET    | `/reports/receivables` | Staff  | Read balances and aging as of a date                 |
| GET    | `/exports/{dataset}`   | Staff  | Export an allowlisted business dataset               |
| POST   | `/imports/validate`    | Admin  | Upload and validate migration data                   |
| GET    | `/imports/{id}`        | Admin  | Read validation and reconciliation results           |
| POST   | `/imports/{id}/commit` | Admin  | Commit an approved migration                         |
| GET    | `/audit-events`        | Admin  | Search the audit history                             |

**11.6 MVP 2 operations**

| Method    | Path                           | Access      | Purpose                                        |
| --------- | ------------------------------ | ----------- | ---------------------------------------------- |
| GET       | `/lots/{id}/spots`             | Staff       | Read physical spots and computed occupancy     |
| POST      | `/lots/{id}/spots`             | Admin       | Add verified physical capacity                 |
| PATCH     | `/spots/{id}`                  | Staff/Admin | Change permitted metadata or condition         |
| GET       | `/lots/{id}/occupancy`         | Staff       | Read a timestamped physical snapshot           |
| GET       | `/lots/{id}/availability`      | Staff       | Read availability for an interval and category |
| GET       | `/lots/{id}/sessions`          | Staff       | Search active or historical sessions           |
| POST      | `/lots/{id}/sessions/check-in` | Staff       | Check in a vehicle                             |
| POST      | `/sessions/{id}/check-out`     | Staff       | Check out and calculate applicable charges     |
| GET / PUT | `/lots/{id}/hourly-rates`      | Staff/Admin | Read rates or publish a new version            |

Spot retirement preserves history. There is no ordinary hard-delete route.

**11.7 MVP 3 public and driver endpoints**

| Method             | Path                                       | Access        | Purpose                                    |
| ------------------ | ------------------------------------------ | ------------- | ------------------------------------------ |
| GET                | `/public/lot`                              | Public        | Read public lot details                    |
| GET                | `/public/availability`                     | Public        | Read interval-based availability           |
| POST               | `/auth/register`                           | Public        | Create an individual driver account        |
| POST               | `/auth/email-verification/request`         | Public        | Request verification delivery              |
| POST               | `/auth/email-verification/confirm`         | Public        | Confirm the email                          |
| POST               | `/auth/password-reset/request`             | Public        | Request a reset with a uniform response    |
| POST               | `/auth/password-reset/confirm`             | Public        | Complete a reset                           |
| GET / POST / PATCH | `/me/vehicles…`                            | Driver        | Manage owned vehicle records               |
| POST               | `/reservation-quotes`                      | Driver        | Request a priced proposal                  |
| GET / POST         | `/reservations`                            | Driver/Staff  | List permitted records or create a hold    |
| GET                | `/reservations/{id}`                       | Owner/Staff   | Read reservation and financial context     |
| POST               | `/reservations/{id}/checkout`              | Owner         | Start provider checkout                    |
| POST               | `/reservations/{id}/modifications`         | Owner/Staff   | Create a proposed change and required hold |
| GET                | `/reservation-modifications/{id}`          | Owner/Staff   | Read change/payment status                 |
| POST               | `/reservation-modifications/{id}/checkout` | Owner         | Pay an increase                            |
| POST               | `/reservation-modifications/{id}/confirm`  | Owner/Staff   | Commit an eligible change                  |
| POST               | `/reservations/{id}/cancel`                | Owner/Staff   | Cancel under the defined policy            |
| GET                | `/me/invoices`                             | Driver        | List owned invoices                        |
| GET                | `/me/payments`                             | Driver        | List owned payments and refunds            |
| GET                | `/notifications`                           | Authenticated | Read the caller’s notifications            |
| POST               | `/notifications/{id}/read`                 | Owner         | Mark a notification read                   |
| POST               | `/notifications/read-all`                  | Authenticated | Mark the caller’s notifications read       |

Provider webhook endpoints belong to the backend contract and use provider signature verification. They do not use browser sessions or browser CSRF headers.

The concrete paths and schemas represented by `/me/vehicles…` must be enumerated in OpenAPI before MVP 3 implementation.

**11.8 Deferred endpoints**

The following are not implemented in MVP 1–3:

- Creating or deleting lots.
- Assigning operators to multiple lots.
- Multi-lot geographic search.
- Customer or financial-record hard deletion.
- Arbitrary reservation-status updates.
- Complex pricing-rule CRUD.
- Map-provider integration.

**12. Consistency, errors, and retries**

**12.1 Concurrency**

Capacity checks and commitment creation must be atomic.

When two requests compete for the final compatible space, at most one succeeds.

Version-sensitive changes use `If-Match` with the resource version.

A stale version produces `412 Precondition Failed`. The frontend reloads the record and asks the user to review the current state.

**12.2 Idempotency**

An `Idempotency-Key` is required for:

- Invoice issuance.
- Recording payments.
- Credit and refund operations.
- Billing-run issuance.
- Check-in and checkout.
- Reservation creation.
- Reservation modification and cancellation.
- Online checkout creation.
- Import commitment.

The client creates one key per intended operation and reuses it for retries of that operation.

The backend associates the key with the actor, operation, and request content.

Reusing a key with different content returns a conflict.

Idempotency records are retained for at least 30 days. Permanent business uniqueness constraints still prevent duplicate recurring charges and duplicate provider transactions.

**12.3 Error shape**

Application errors contain:

- `code`: stable machine-readable identifier.
- `message`: safe fallback text.
- `request_id`: support correlation identifier.
- `field_errors`: optional field-specific validation details.
- `details`: optional structured context safe for the caller.

Example codes:

`CAPACITY_UNAVAILABLE`  
`QUOTE_EXPIRED`  
`VEHICLE_PERIOD_ALREADY_BILLED`
`INVOICE_NOT_EDITABLE`  
`PAYMENT_ALREADY_RECORDED`  
`INVALID_STATE_TRANSITION`  
`SESSION_EXPIRED`  
`CSRF_REJECTED`  
`LOT_SETUP_REQUIRED`

FastAPI validation errors must be normalized into the documented error contract.

| Status    | Use                                                        |
| --------- | ---------------------------------------------------------- |
| 200 / 201 | Successful read, action, or creation                       |
| 202       | Accepted asynchronous operation with a status resource     |
| 204       | Successful action with no response body                    |
| 400       | Malformed or unsupported request                           |
| 401       | Missing, expired, revoked, or invalid authentication       |
| 403       | Forbidden operation or rejected browser-origin/CSRF checks |
| 404       | Missing resource or resource hidden by ownership policy    |
| 409       | Capacity, lifecycle, uniqueness, or idempotency conflict   |
| 412       | Stale resource version                                     |
| 422       | Field validation failure                                   |
| 429       | Rate limit exceeded                                        |
| 500 / 503 | Unexpected failure or temporary service unavailability     |

A timeout is an unknown result until the operation is reconciled. It must not automatically be displayed as a definite failure.

**13. Authentication, security, and privacy**

**13.1 Sessions**

- Use server-side sessions.
- Use a host-only cookie named `__Host-session_id`.
- Cookie attributes: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- Do not set a `Domain` attribute.
- Generate session identifiers with at least 32 bytes of secure randomness.
- Never expose session identifiers to JavaScript or store them in browser-readable storage.
- Create a new session identifier after login.
- Revoke the prior session associated with that browser login.
- Logout revokes the current session and clears its cookie.
- Password reset, account deactivation, and permission changes revoke affected sessions.
- Prevent deactivation or demotion of the last active admin.

**13.2 Idle timeout**

- Idle timeout: 30 minutes.
- Absolute lifetime: eight hours.
- Background polling and automatic query retries do not extend idle time.
- Deliberate user actions and authenticated activity reports may extend idle time.
- The frontend reports keyboard, pointer, or touch activity at most once per minute while actual interaction occurs.
- The backend enforces both expiration limits.
- Expired sessions cannot be revived through an activity request.
- Show an expiration warning when possible.
- Logout and account changes clear sensitive cached application data.

**13.3 Browser requests**

Use one origin in production, with `/api` routed to the backend.

State-changing browser requests require:

- `X-Requested-With: XMLHttpRequest`.
- An allowed request origin, checked through `Origin` or an approved `Referer` fallback.
- The expected content type.

Reject requests that fail these checks.

If cross-origin development is supported, its exact origins, methods, and headers must be explicitly configured. Do not enable broad origin matching.

Local development must provide a tested HTTPS configuration or documented equivalent development configuration. Cookie behavior must be tested in the supported browsers.

**13.4 Passwords and recovery**

- Store passwords using an approved salted password-hashing configuration.
- Rate-limit login and recovery attempts.
- Temporary recovery credentials expire and are single-use.
- Reset requests must not disclose whether an account exists.
- Email-based recovery is available to both staff and drivers once introduced in MVP 3.
- Staff recovery must already be available in MVP 1 through admin and backend recovery workflows.

**13.5 Data protection**

- No secrets in the frontend bundle.
- HTTPS everywhere outside explicitly documented local development.
- Server-side validation for every write.
- No card information in OceanLink forms or storage.
- Redact passwords, session identifiers, payment secrets, and unnecessary customer data from logs.
- Do not send invoice contents, plates, contact details, or session recordings to usage analytics.
- Keep customer information out of public responses.
- Financial history remains retained unless an explicit retention policy and deletion workflow are later approved.

**14. Frontend behavior and technical requirements**

**14.1 Stack**

- React with TypeScript strict mode.
- Vite.
- React Router.
- TanStack Query.
- React Hook Form and Zod.
- MUI for shared components.
- Vitest and React Testing Library.
- Playwright for core end-to-end flows.
- ESLint and Prettier.

Pin compatible dependency versions. Do not depend on unbounded latest versions during builds.

No component requiring a paid license is necessary for the initial implementation.

**14.2 API integration**

- Generate the typed client from a versioned FastAPI OpenAPI schema.
- Keep wire field names consistent.
- If a presentation layer maps names to another convention, use one explicit mapping layer.
- Use a shared HTTP client with cookies, CSRF headers, error normalization, request IDs, and idempotency support.
- Use a same-origin `/api/v1` base path in deployed environments.
- Generate development mocks from the agreed contract.
- Contract changes must update the schema, frontend integration, and affected acceptance tests together.

OpenAPI defines serialization and endpoint shapes. It does not replace the business rules in this document.

**14.3 Required UI states**

Every main screen defines loading, empty, error, permission-denied, and retry states.

Specific behavior:

- Failed login shows a login error rather than redirecting in a loop.
- Expired authenticated sessions trigger reauthentication.
- A CSRF rejection produces a distinct recoverable error and diagnostic reference.
- Stale occupancy displays its last successful update time.
- Offline status is visible.
- Mutations are disabled while offline.
- Automatic offline write queues are out of scope.
- Unknown mutation outcomes are reconciled before the user is encouraged to repeat the operation.
- Version conflicts show current data and require review.
- Ordinary validation errors retain entered form data.
- Destructive or financial correction actions clearly explain their effect before submission.
- Search and filters persist during ordinary navigation.
- Successful changes refresh all affected balances, lists, and summaries.

**14.4 Performance**

- Use route-level code splitting and paginated server queries.

Bulk imports, PDF generation, and billing runs have separate progress and timeout behavior. They must not freeze the application.

**14.5 Accessibility and browser support**

Every release targets WCAG 2.1 AA.

Verify:

- Keyboard access.
- Visible focus.
- Form labels and associated validation errors.
- Accessible dialogs.
- Table headers and readable alternatives for charts.
- Status indicators that do not rely only on color.
- Usable touch targets and responsive layouts.

Support the latest two released versions of Chrome, Edge, Firefox, and Safari at release time, including the relevant mobile browsers.

Record the actual tested versions in release validation.

**15. Existing-data migration**

Migration is part of MVP 1.

**15.1 Required data**

- Customers and contact details.
- Vehicles and customer relationships. Each vehicle needs a plate or a USDOT number; records with neither fail validation.
- Active vehicle monthly parking, rate history and customer billing defaults.
- Current rates and billing schedules.
- Unpaid invoices or approved opening receivables.
- Unapplied customer credits.
- Existing identifiers needed to trace records back to the old application.

Historical records may be imported where the source data supports reliable mapping.

**15.2 Import process**

1. Export data from the existing application.
2. Validate required fields, references, dates, amounts, and duplicates.
3. Display a dry-run report.
4. Reconcile customer and vehicle counts.
5. Reconcile balances by customer and in total.
6. Take a recoverable backup.
7. Commit the approved import.
8. Produce a reconciliation report.

Each imported record preserves a source identifier.

Repeating the same import must not create duplicates.

**15.3 Opening balances**

Use detailed outstanding invoices when available.

If an opening-balance entry is used instead, mark it explicitly as a migration adjustment with a cutoff date.

Do not import both the detailed debt and a second opening balance for the same debt.

Opening credits and balances must not appear as newly collected cash.

Do not silently convert existing billing schedules or change customer rates during migration.

**15.4 Cutover**

Define a cutoff date and time for live changes.

Before cutover:

- Resolve unsupported legacy terms and obtain owner-approved per-vehicle allocations for any legacy combined contract prices. Never silently divide a contract total among vehicles.
- Reconcile all included balances to the cent.
- Verify representative invoices in both languages.
- Confirm a tested backup and restore procedure.
- Document how transactions entered during the transition are handled.

After cutover, staff use one authoritative system for new financial transactions. The previous application may remain available for read-only historical reference.

**16. Deployment and backend dependencies**

**16.1 AWS**

- Private S3 bucket for static assets.
- CloudFront for frontend delivery.
- Route 53 and ACM for DNS and TLS.
- `/api` forwarded to the backend.
- GitHub Actions for build, tests, and deployment.
- AWS CDK in TypeScript for infrastructure definitions.
- Separate `dev`, `staging`, and `prod` environments.

Production deployment must have a rollback procedure.

Development and staging use synthetic or appropriately sanitized customer data.

**16.2 CloudFront behavior**

- Forward required API cookies, headers, methods, and query parameters.
- Disable caching for authenticated API responses.
- Do not cache session-setting responses.
- Keep API errors as API responses.
- Apply single-page application route fallback only to frontend routes.

**16.3 Backend hosting**

The initial backend uses one server with persistent local storage.

SQLite is an implementation choice suitable for the intended initial workload. The deployment must account for serialized writes and transient database contention.

A shared network volume is not an approved scaling strategy by itself.

Autoscaling, multi-host database access, and high availability require a separate reviewed design.

**16.4 Backups and recovery**

- Create consistent database backups using a supported SQLite backup mechanism.
- Do not rely on copying an actively changing database file without a consistency procedure.
- Back up at least hourly and before imports or schema migrations.
- Keep encrypted backups separate from the application server.
- Retain at least 30 days of backups.
- Initial recovery-point target: no more than one hour of lost committed data.
- Initial recovery-time target: service restored within four hours.
- Test restoration before the first production release and periodically afterward.

Restore validation includes customer balances, invoice totals, payment allocations, vehicle monthly rates and history, and applicable parking commitments.

**16.5 Scheduled work**

Recurring billing is initiated by staff in MVP 1.

MVP 3 requires durable handling of hold expiry, provider-event reconciliation, and notification delivery.

These may run through scheduled work on the existing backend server. A separate queue service is not required.

Expiration must also be enforced when requests are processed. Delayed background cleanup must not make an expired hold valid.

**17. Acceptance criteria**

**17.1 MVP 1 is complete when**

- The parents can perform the customer-to-payment workflow in English and Chinese.
- One customer can have multiple vehicles with distinct monthly rates, service dates and preserved pricing history.
- Staff can preview, issue, print, and download invoices.
- Partial payments produce the correct remaining balance.
- Overpayments become customer credit.
- Credits, corrections, and refunds preserve a traceable history.
- Repeating invoice issuance or a payment request does not duplicate the transaction.
- Existing data and opening balances reconcile before cutover.
- Staff accounts can be deactivated, and affected sessions stop working.
- The last active admin cannot be removed or demoted.
- Financial and access changes appear in the audit history.
- Core workflows pass accessibility and browser checks.
- Backups have been restored successfully in a test environment.
- The production release is usable for the migrated business.

Required financial example:

A customer has two monthly charges of $200 and $250. The issued invoice totals $450. A $300 payment leaves $150 due. An authorized $100 credit reduces the remaining balance to $50.

**17.2 MVP 2 is complete when**

- A monthly customer can check in without consuming contractual capacity twice.
- Checkout removes physical presence but preserves monthly entitlement.
- A walk-in can be assigned compatible capacity, checked out, invoiced, and paid through the offline payment workflow.
- Duplicate check-in or checkout retries do not create duplicate sessions or charges.
- Two competing requests cannot both obtain the final available capacity.
- Occupancy updates within the polling target under healthy connectivity.
- Stale data and offline state are visible.
- Overstays and emergency capacity loss appear as actionable exceptions.
- Staff can complete the main operational workflow on a phone or tablet.

**17.3 MVP 3 is complete when**

- A driver can browse the lot before registering.
- A verified driver can obtain a quote, create a hold, pay, and receive an invoice.
- Concurrent bookings cannot oversell the available category.
- Expired holds release capacity.
- Successful payment after expiry follows the defined refund workflow.
- Duplicate provider events do not duplicate reservations, receipts, or refunds.
- A failed modification preserves the original booking.
- Cancellation and refund status are displayed separately.
- A driver cannot access another customer’s records by changing an identifier.
- No-shows and overstays follow the documented policies.
- Payment and email integrations are validated in staging and configured for production.
- The complete driver flow passes the accessibility and browser requirements.

**18. Deferred scope**

The following remain explicitly deferred:

- Multiple lots and operator-to-lot assignments.
- Map-based lot search.
- Guaranteed numbered-bay selection for drivers.
- Shared fleet portals and multi-user company accounts.
- Dynamic or demand-based pricing.
- Weekday and time-of-day pricing engines.
- Automatic late fees.
- Automatic monthly card charging.
- SMS and mobile push notifications.
- Offline write synchronization.
- WebSockets and SSE.
- General-ledger accounting.
- Automated tax determination.
- Permanent deletion of financial history.
- Autoscaled or multi-region backend deployment.

These features must not be introduced implicitly while implementing the three MVPs.
