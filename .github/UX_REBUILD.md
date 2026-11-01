# OceanLink Frontend Rebuild: UX and Build Directions

Directions for generating a new React frontend for OceanLink from scratch. Give this file, together with the specs it links to, to the person or coding agent doing the build.

The new UX has one main goal: **readability**. The main users are the lot owners (parents) and trusted staff. They are not technical, read English or Chinese, and often use a laptop or tablet. Every screen should be easy to scan, use large and high-contrast text, and make the next step obvious.

---

## 0. How to use this document

1. Read the sources of truth in section 1 before writing code.
2. Build in the order given in section 13. Finish and check each phase before starting the next.
3. When this file and a spec disagree, follow section 1.2. When something is still unclear, ask. Do not invent a business rule, endpoint, or field.
4. Section 15 has a ready-to-paste prompt for a coding agent.

---

## 1. Sources of truth

| File | What it decides |
| --- | --- |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Product scope, MVP 1 workflows, business rules, permissions, UI states, accessibility |
| [BACKEND_REQUIREMENTS.md](BACKEND_REQUIREMENTS.md) | Exact endpoints, request and response shapes, error codes, which endpoints exist today |
| [BACKEND_LOGIC_CHANGES.md](BACKEND_LOGIC_CHANGES.md) | Recent rule changes the backend must follow |
| [GLOBAL_CONTEXT.md](GLOBAL_CONTEXT.md) | Glossary, stack decisions, conventions, writing rules |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Hosting, environments, `VITE_` config |
| [agents/frontend.md](agents/frontend.md) | Engineering standards and definition of done |
| This file | Look and feel, layout, screen designs, build order |

Priority when sources conflict: the owner's latest instruction, then REQUIREMENTS.md, then BACKEND_REQUIREMENTS.md (the API contract), then this file, then old code.

### 1.1 Scope

Build **MVP 1 only**: staff sign-in, customers, vehicles, vehicle monthly parking, monthly charges, one-time charges, recorded payments, balances, and the overview dashboard.

Do not build: driver accounts, public booking, online payment, check-in/out, live occupancy, multiple lots, maps, or charts based on data the API does not return.

### 1.2 Decisions already made (these override older spec text)

| Topic | Decision | Older text it replaces |
| --- | --- | --- |
| Balance color | A positive amount owed is shown in **red text** everywhere: Overview total, customer list, customer account. Zero is neutral. Credit is green and labeled "Customer credit". | REQUIREMENTS 4.4 says balances stay neutral unless an overdue amount exists. Update that line. |
| Truck count on customers | Do not show a truck count in the customer account summary or the customer list. The customer's **Vehicles** section shows the count, for example "Vehicles (3)", using the list `total`. | REQUIREMENTS 4.4 mentions a balance/truck-count summary on mobile cards. Update that line. |
| Adding a vehicle | The Add vehicle form has an optional **Monthly parking amount**. When an amount is entered (including 0), a **Billing start date** is required and both are saved with the vehicle in one request. | None. See BACKEND_REQUIREMENTS 6.4. |
| API base path | `VITE_API_BASE_URL=/api/v1` | DEPLOYMENT.md uses `/api`. Listed as a known inconsistency in GLOBAL_CONTEXT. |
| Refresh after money changes | Recording or reversing a payment, issuing monthly charges, and issuing a one-time charge must refresh the Overview, the customer list, and the customer account. | Required by REQUIREMENTS 14.3. It was missed in the old build. |

### 1.3 Writing rules (from GLOBAL_CONTEXT)

- Absolutely no em dashes in UI text, code comments, or docs.
- Comments are short and plain.
- No hardcoded UI text. Every string exists in English and Simplified Chinese.

---

## 2. Visual direction

The owner supplied two reference designs. Take the structure from them, not the exact pixels.

### 2.1 What to take from each reference

**Reference A: "Trucklots" admin dashboard (desktop, blue sidebar)**

Use:
- A solid brand-blue left sidebar with white icons and labels. It makes "where am I" obvious at a glance.
- A white top bar with a breadcrumb on the left ("Customers > Pacific Haul LLC") and the user menu on the right.
- A light gray page background with white cards on top.
- Clean data tables: one row per record, clear column headers, status pills, a row action menu, and "Page 1 of 15" pagination at the top right of the table card.
- A filter bar above tables: search, a few simple filters, and one Apply button.
- A detail page that starts with an identity card (photo or initials, name, key facts in label: value pairs), then tabs for related records.

Do not copy:
- The very small table text. Ours is larger (section 3.2).
- The pale gray secondary text. It fails contrast.
- Decorative charts. Only show a chart when an endpoint returns that data (not in MVP 1).
- The driver avatars. Customers have no photos, so use initials tiles.

**Reference B: "Parkalot" manage items (tablet, white sidebar)**

Use:
- A large, bold page title at the top of the content area.
- Underlined page tabs below the title.
- A toolbar row: search on the left, primary action button and a secondary outlined button on the right.
- Form cards with a colored **icon tile** on the left of the card title.
- Related fields grouped in a **tinted inset panel** with its own small heading (their "Ownership" box). Use this for "Monthly parking" inside vehicle forms and for "Contact details" in customer forms.
- Sidebar section labels in small caps ("DAILY WORK", "ADMIN") and the profile and log out links pinned to the bottom of the sidebar.
- Generous white space between cards.

Do not copy:
- Light gray placeholder text used as the only label. Every field has a visible label above it.
- Pale gray nav text. Our sidebar text is white on blue.

### 2.2 The combined look

```
+--------------------+----------------------------------------------------------+
| [O] OceanLink      |  Customers > Pacific Haul LLC        EN | 中文   (AA) Ada v|
|                    +----------------------------------------------------------+
|  DAILY WORK        |                                                          |
|  > Overview        |  Pacific Haul LLC                         [ Edit ]       |
|  > Customers  <==  |  Business . USDOT 2345678 . Active                       |
|  > Vehicles        |                                                          |
|  > Payments        |  +----------------------+  +---------------------------+  |
|                    |  | Customer account     |  | Contact                   |  |
|  BILLING           |  | Owes                 |  | Maria Lopez               |  |
|  > Invoices        |  | $931.00   (red)      |  | (555) 010-1002            |  |
|  > Reports         |  | Overdue: $50.00      |  | ...                       |  |
|                    |  | [ Record payment ]   |  +---------------------------+  |
|  ADMIN             |  +----------------------+                                 |
|  > Settings        |                                                          |
|                    |  Vehicles (3)  |  Transactions  |  Details               |
|                    |  ------------                                            |
|  ----------------  |  +----------------------------------------------------+  |
|  ( ) My profile    |  | Vehicle     | Type  | Plate / USDOT | Monthly rate |  |
|  [>] Log out       |  | Unit 7      | Truck | USDOT 2345678 |      $300.00 |  |
+--------------------+  +----------------------------------------------------+  |
```

Light theme only for MVP 1. Add `<meta name="color-scheme" content="light">` so browsers do not invent their own dark colors and change meaning (for example, a red balance turning gray).

---

## 3. Design tokens

Put all tokens in one MUI theme file (`src/app/theme.ts`). Components never use raw hex values.

### 3.1 Color

All text pairs below were checked against WCAG 2.1. The ratio is shown so nobody "lightens it a bit" later.

| Token | Hex | Use | Contrast |
| --- | --- | --- | --- |
| `primary.main` | `#2448D8` | Sidebar background, primary buttons, links, active tab underline | White on it 7.0:1. On white 7.0:1 |
| `primary.dark` | `#1B37A8` | Hover and pressed states, active nav item background | White on it 9.7:1 |
| `primary.light` (tint) | `#EEF2FF` | Inset panels, selected table row, icon tile background | `#2448D8` on it 6.3:1 |
| `sidebar.mutedText` | `#DCE4FF` | Section labels in the sidebar | On `#2448D8` 5.5:1 |
| `background.default` | `#F4F6FA` | Page background | |
| `background.paper` | `#FFFFFF` | Cards, tables, dialogs, top bar | |
| `divider` | `#E3E7EF` | Card borders, table row lines (decorative only) | |
| `inputBorder` | `#7A8499` | Text field and select borders | 3.8:1 (UI components need 3:1) |
| `text.primary` | `#111827` | All main text and numbers | 17.7:1 |
| `text.secondary` | `#4B5563` | Labels, helper text, captions | 7.6:1 on white, 7.0:1 on page bg |
| `error.main` | `#B42318` | Amount owed, overdue, errors, destructive actions | 6.6:1 on white |
| `error.light` (tint) | `#FEECEB` | Overdue pill background, error alert background | `#B42318` on it 5.8:1 |
| `success.main` | `#116932` | Customer credit, Paid, Active | 6.8:1 on white |
| `success.light` (tint) | `#E7F6EC` | Active and Paid pill background | `#116932` on it 6.1:1 |
| `warning.main` | `#8A4B00` | Not billed yet, needs attention | |
| `warning.light` (tint) | `#FFF4E5` | Warning pill and alert background | `#8A4B00` on it 6.3:1 |

Rules:
- Never use a gray lighter than `#4B5563` for any text, including placeholders, disabled hints, and table captions. Disabled controls may use MUI's default disabled styling, but their label must still be readable.
- Color is never the only signal. A red amount always sits next to a word ("Owes", "Overdue"). A status pill always has text.

### 3.2 Typography

Base font size is **16px**. Nothing a user needs to read is smaller than **14px**.

Font stack: `system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`.

| Role | Size / line height | Weight | Example |
| --- | --- | --- | --- |
| Page title (h1) | 28px / 1.25 (24px under 600px wide) | 700 | "Customers" |
| Section title (h2) | 20px / 1.3 | 600 | "Customer account" |
| Card title (h3) | 18px / 1.35 | 600 | "Monthly parking" |
| Body | 16px / 1.5 | 400 | Paragraphs, field values |
| Field label | 15px / 1.4 | 500 | "Phone" above a value |
| Table cell | 15px / 1.45 | 400 | Row content |
| Table header | 14px / 1.4 | 600, `text.secondary` | "Monthly rate" |
| Caption, helper text | 14px / 1.45 | 400 | Field hints |
| Hero amount | 36px / 1.15 (32px on phones) | 700, tabular numbers | "$931.00" |
| KPI amount | 28px / 1.2 | 700, tabular numbers | "$300.00" |
| Button | 16px | 600, sentence case (no ALL CAPS) | "Record payment" |

- Use `font-variant-numeric: tabular-nums` for every money, date, and count value.
- Keep reading text to at most 72 characters per line (`max-width: 72ch`) in alerts and descriptions.
- Do not use uppercase text except the small sidebar section labels.

### 3.3 Spacing, shape, and size

- Spacing unit: 8px. Card padding 24px on desktop and 16px on phones. Gap between cards 24px (16px on phones).
- Corner radius: 12px for cards and dialogs, 8px for buttons, inputs, and pills.
- Cards: white, 1px `divider` border, no heavy shadow (at most `0 1px 2px rgba(17,24,39,.06)`).
- Touch targets: at least **44 x 44px**. Primary buttons are 48px tall.
- Table rows: at least 56px tall. This is the "comfortable" density. Do not add a compact mode.
- Content max width: 1280px, centered. Forms max width 760px.
- Visible focus ring on every interactive element: 3px outline in `primary.main` with 2px offset.
- Respect `prefers-reduced-motion`: no sliding animations when it is set.

### 3.4 Icons

Use `@mui/icons-material`, Outlined variants, 24px in nav and 20px inline. Every icon-only button needs an accessible name and a tooltip.

| Item | Icon |
| --- | --- |
| Overview | `DashboardOutlined` |
| Customers | `PeopleAltOutlined` |
| Vehicles | `LocalShippingOutlined` |
| Payments | `PaymentsOutlined` |
| Invoices | `ReceiptLongOutlined` |
| Reports | `AssessmentOutlined` |
| Settings | `SettingsOutlined` |
| My profile | `AccountCircleOutlined` |
| Log out | `LogoutOutlined` |

---

## 4. App shell

### 4.1 Sidebar

- Background `primary.main`, text white.
- Top: the OceanLink logo mark and name, then the lot name from `GET /lots/current` in `sidebar.mutedText`.
- Groups with small-caps labels:
  - **Daily work:** Overview, Customers, Vehicles, Payments
  - **Billing:** Invoices, Reports
  - **Admin** (admins only): Settings
- Bottom, pinned: My profile, Log out.
- Active item: `primary.dark` background, white text, 4px white bar on the left edge, and `aria-current="page"`. Hover: 12% white overlay.
- Items are links (`<a>`), inside a `<nav aria-label="Main">`.
- Hiding Settings from operators is a convenience only. The backend enforces permissions.

### 4.2 Top bar

- White, 64px tall, bottom border `divider`.
- Left: menu button (only when the sidebar is collapsed or hidden), then the breadcrumb.
- Right: language switch ("EN | 中文", always visible, remembered per user through `PATCH /users/me` when available and local storage until then), then the user menu (initials avatar, name, role). The user menu holds My profile, Change password, and Log out.

### 4.3 Responsive behavior

| Width | Sidebar | Notes |
| --- | --- | --- |
| 1200px and wider | Expanded, 264px | Full layout |
| 900px to 1199px (tablet landscape) | Icon rail, 80px, labels in tooltips; menu button opens it as an overlay | Tables keep all columns |
| Under 900px (tablet portrait and phones) | Hidden; menu button opens a full-height drawer | Tables become cards (section 5.3); the page's main action becomes a floating button at bottom right. Under 600px the top bar shows only a back link to the parent page instead of the full breadcrumb, because the page title already names the current page. |

No horizontal page scrolling at any width. Wide tables scroll inside their own card only, and the first column stays visible.

### 4.4 Global banners

Shown directly under the top bar, above page content:
- **Offline:** "You are offline. Changes are paused until you reconnect." All save buttons are disabled while offline.
- **Session ending:** two minutes before idle expiry, a dialog: "You will be signed out soon" with "Stay signed in" (calls `POST /auth/activity` when available) and "Sign out".
- **Lot not set up** (`503 LOT_SETUP_REQUIRED`): a full-page message telling an admin to finish lot setup. Do not guess a lot.

---

## 5. Shared components

Build these first (phase 2). Pages are assembled only from these plus MUI primitives.

### 5.1 PageHeader

Breadcrumb (in the top bar), then a row with the h1 title and optional subtitle on the left and actions on the right (one contained primary button, at most two outlined secondary buttons). Optional underlined tabs below, which change the URL.

### 5.2 FilterBar

A white card above a table. Contains:
- Search field with a visible label, a search icon, and a clear button. Search runs 300ms after typing stops.
- Up to three simple filters (checkboxes or selects), for example "Show inactive" and "Overdue only".
- On phones, extra filters fold into a "Filters (2)" button that opens a bottom sheet with Apply and Clear.
- Search text and filters live in the URL query string so Back keeps them (REQUIREMENTS 14.3).

### 5.3 DataTable (pattern, not a grid library)

Use MUI `Table` with real table semantics. Do not add a data-grid dependency.
- Card wrapper. Header row: table title and result count on the left ("57 customers"), "Page 1 of 3" with previous and next buttons on the right.
- Column headers 14px, 600 weight, `text.secondary`, on a `#F4F6FA` header row.
- Text columns left aligned. **Money and counts right aligned** with tabular numbers. Status column centered.
- The first column is the record name, shown as a link to its detail page. The whole row is clickable, but the link is the keyboard target.
- Row actions: one visible primary action when useful, otherwise a "More actions" menu (three dots) with an accessible name that includes the record name.
- Empty, loading (5 skeleton rows), and error states render inside the card.
- Under 900px each row becomes a card: name and status on the first line, two or three key facts, and the key amount on a footer line. Same data, same order.

### 5.4 StatusPill

Rounded pill with text, a tint background, and a dark text color from section 3.1. Variants: Active, Inactive, Paid, Partly paid, Unpaid, Overdue, Reversed, Draft, Issued, Void, Not set up. Never color-only.

### 5.5 Money

One `<Money>` component. Input is integer cents. Output uses `Intl.NumberFormat(locale, { style: "currency", currency: "USD" })`. Props control tone:
- `tone="owed"`: red when greater than 0, with the word "Owes" in the label next to it.
- `tone="credit"`: green, label "Customer credit", shows the absolute value (never a minus sign).
- `tone="neutral"`: `text.primary`.

Never do money math on the client except converting typed dollars to cents for a request. Totals come from the API.

### 5.6 KeyValueList

Label above value, in a two-column grid on desktop and one column on phones. Uses `<dl>`, `<dt>`, `<dd>`. Empty values show "Not provided" in `text.secondary`, never a blank.

### 5.7 SectionCard and InsetGroup

- `SectionCard`: white card with optional icon tile (40px, `primary.light` background, `primary.main` icon), h3 title, optional action on the right.
- `InsetGroup`: `primary.light` tinted panel inside a card, 16px padding, small h4 heading. Used for grouped fields (Reference B's "Ownership" box).

### 5.8 Feedback

- `LoadingState`: skeletons shaped like the final content. Avoid full-page spinners after the first load.
- `EmptyState`: icon, one sentence explaining what is missing, and the action to fix it ("No vehicles yet. Add vehicle").
- `ErrorState`: what failed, whether anything was saved, a Retry button, and the problem number (`request_id`) in small text.
- `Toast` for confirmed successes only ("Payment recorded."). Errors stay on the page, never only in a toast.
- `ConfirmDialog` for destructive actions. Title names the target ("Deactivate Pacific Haul LLC?"). Body explains the effect. The confirm button repeats the verb ("Deactivate").
- `ReviewStep` for financial actions: a read-only summary of exactly what will be sent, a sentence about what it does and does not do, then "Back" and a confirm button.

### 5.9 Forms

- React Hook Form plus Zod. Visible label above every field. Required fields marked with "*" and a "* Required" note at the top of the form.
- Helper text under the field for examples ("Example: 1234567").
- Validate on blur and on submit. On submit failure, focus the first invalid field and show a summary alert at the top listing the problems.
- Server `field_errors` codes map to translated messages on the matching field.
- Keep everything the user typed when saving fails.
- Warn before leaving a form with unsaved changes.
- Money inputs: text field with `inputMode="decimal"`, "$" adornment, two decimal places max.
- Dates: native date input with the label stating the meaning ("Billing starts").
- One primary button at the bottom right ("Save customer"), Cancel to its left. On phones, buttons are full width and the primary is on top.

---

## 6. Routes and navigation

| Route | Screen | Status |
| --- | --- | --- |
| `/login` | Sign in | Build now |
| `/` | Overview | Build now |
| `/customers` | Customer list | Build now |
| `/customers/new` | Add customer | Build now |
| `/customers/:id` | Customer detail (tabs: `?tab=vehicles`, `transactions`, `details`) | Build now |
| `/customers/:id/edit` | Edit customer | Build now |
| `/vehicles` | Vehicle list | Build now |
| `/vehicles/new?customer_id=` | Add vehicle | Build now |
| `/vehicles/:id` | Vehicle detail and edit | Build now |
| `/payments` | Payments received | Build now |
| `/invoices` | Invoices | Placeholder until list endpoint without `customer_id` exists |
| `/reports` | Reports | Placeholder until `/reports/collections` and `/reports/receivables` exist |
| `/settings/*` | Lot, staff accounts (admin) | Placeholder until `/admin/users` and `PATCH /lots/{id}` exist |
| `/profile` | My profile, change password | Placeholder until `/auth/change-password` and `PATCH /users/me` exist |
| `*` | Not found | Build now |

A placeholder page is honest: title, one sentence on what the page will do, and "This page is not available yet." Never show fake data.

Every protected route requires a session. A `403` shows a "You do not have access to this page" screen, not a redirect loop. Users with `must_change_password` see only the change-password screen.

---

## 7. Screen specifications

Each screen lists layout, data, actions, and states. Every screen must also cover loading, empty, error, permission-denied, and retry (REQUIREMENTS 14.3).

### 7.1 Sign in

- Centered white card (max 440px) on the page background with the logo above it.
- Fields: Email, Password (with show/hide button). Button: "Sign in". Language switch at the top right of the page.
- Errors by code: `INVALID_CREDENTIALS` "Email or password is incorrect." `ACCOUNT_INACTIVE` "This account is turned off. Ask an admin." `RATE_LIMITED` "Too many attempts. Try again in a few minutes." Never redirect in a loop.

### 7.2 Overview

Redesigned 2026-10-31 at the owner's request: four headline cards, then "Needs attention" and "Payment summary", then "Recent activity" and "Business snapshot". Each card loads on its own, so one failed request never hides the others or turns into a $0.00.

```
Overview                                   [ + Add customer ] [ + Record payment ]
As of Oct 31, 2026

+ Past due ------+ + Paid this month + + Not billed yet -+ + Active customers +
| $50.00 (red)   | | $300.00         | | $280.00         | | 4                |
| 1 customer     | | 1 payment       | | Ready to bill   | | 5 total · 1 inactive
| Follow up ->   | | View payments ->| | Review charges->| | View customers ->|
+----------------+ +-----------------+ +-----------------+ +------------------+

+ Needs attention ----------------------------+ + Payment summary ----------+
| (!) 远航货运有限公司                          | | Unpaid invoices  $150.00  |
|     $50.00 overdue · owes $150.00 in total  | |   Past due        $50.00  |
| (!) 2 more customers past due               | |   Not due yet    $100.00  |
| (o) 1 vehicle's monthly parking ends soon   | | Not billed yet   $280.00  |
| (i) 1 customer has no phone or email        | | Collected this month      |
| (i) 4 vehicles have no monthly parking      | |   Oct 1 to Oct 31 $300.00 |
| View all past due customers ->              | | View payments ->          |
+---------------------------------------------+ +---------------------------+

+ Recent activity ----------------------------+ + Business snapshot --------+
| $300.00 payment from 远航货运有限公司   Oct 1 | | Customers             5   |
| Unit 12 added for 远航货运有限公司     Sep 2 | | Trucks                6   |
| ...                                         | | Vehicles with monthly     |
| View payments ->                            | |   parking             1   |
+---------------------------------------------+ | Customers past due    1   |
                                                +---------------------------+
```

| Card | Data |
| --- | --- |
| Past due | `overdue_invoices` from `GET /reports/summary`; customer count is `total` from `GET /customers?overdue_only=true` |
| Paid this month | `payments_received_this_month`; count is `total` from `GET /payments?from=<1st>&to=<today>&status=received` |
| Not billed yet | `unbilled_parking` |
| Active customers | `total` from `GET /customers` (active only); inactive is `total_customers` minus that |
| Needs attention | Overdue customers sorted by overdue amount (top 3), then vehicles whose monthly parking ends within 30 days, active customers with no phone or email, and active vehicles without monthly parking. Built from `GET /customers` and `GET /vehicles` (first 100 records; the card says so if there are more). |
| Payment summary | `outstanding_invoices`, `overdue_invoices`, not due yet (the difference), `unbilled_parking`, `payments_received_this_month` |
| Recent activity | The 5 newest of: payments recorded or reversed, vehicles added, customers added or changed. Built from records already loaded; there is no activity API yet. |
| Business snapshot | `total_customers`, `total_trucks`, vehicles whose monthly parking covers today, overdue customer count |

- Mapping from the owner's sketch: there are no contracts, so "contracts expiring soon" became monthly parking ending within 30 days, and "active contracts" became vehicles with monthly parking. "Days overdue" is not shown because no endpoint returns the oldest due date; it should be added to the customer list (`oldest_overdue_on`) before it is shown. "Missing billing info" means no phone and no email.
- Amounts owed and past due are red; past due has a red top edge on its card and the word "Past due", so color is never the only signal. Status icons in "Needs attention" sit next to words.
- No chart in MVP 1.
- Do not label monthly-parking vehicles as present on the lot.
- Layout: the four headline cards sit four across from 900px and two by two below that. On phones (under 600px) they shrink: no icon, smaller numbers, and the whole card is the link, marked with an arrow. Content cards drop their icon tile on phones, and Recent activity puts each time under its line.

### 7.3 Customer list

Data: `GET /customers?q=&include_inactive=&overdue_only=&page=&page_size=20`.

```
Customers                                                   [ + Add customer ]

+ FilterBar -----------------------------------------------------------------+
| Search customers [ name, phone, email, or USDOT        ]  [ ] Show inactive |
|                                                           [ ] Overdue only  |
+----------------------------------------------------------------------------+
+ 57 customers                                         Page 1 of 3  [<] [>] -+
| Customer                | Contact            | USDOT   |   Balance  | Status|
| (AB) Pacific Haul LLC   | Maria Lopez        | 2345678 |    $931.00 | Active|
|      Business           | (555) 010-1002     |         | Overdue $50|       |
+----------------------------------------------------------------------------+
```

- Customer column: initials tile, display name as link, type underneath in `text.secondary`.
- Contact: contact name, phone, email on separate lines. Phone is a `tel:` link.
- Balance: right aligned. Positive in red with "Owes" as screen-reader text, credit in green with "Credit", zero neutral. If overdue, a red "Overdue $X" line under it.
- No truck count column.
- Empty with filters: "No customers match. Clear filters". Empty without filters: "No customers yet. Add customer".

### 7.4 Customer detail

Data: `GET /customers/{id}`, `GET /customers/{id}/ledger`, `GET /vehicles?customer_id=`, `GET /payments?customer_id=`, `GET /invoices?customer_id=&source_type=manual`.

```
Customers > Pacific Haul LLC

(PH) Pacific Haul LLC                                 [Active]   [ Edit ]
     Business . USDOT 2345678

+ Customer account ---------------------------+  + Contact ------------------+
| Owes                                         |  | Contact   Maria Lopez     |
| $931.00                    (red)             |  | Phone     (555) 010-1002  |
| Overdue: $50.00            (red)             |  | Email     ...             |
|                                              |  | [ Show all details ]      |
| Last payment  $4,444.00  Oct 24, 2026 . Cash |  +---------------------------+
| Monthly parking  $55.00 per month            |
| Not billed yet   $55.00   [ Review monthly charges ]                         |
|                                              |
| [ Record payment ]  [ Add one-time charge ]  |
| > Balance details (outstanding, credit, overdue, as of time)                |
+----------------------------------------------+

 Vehicles (3)   |   Transactions   |   Details
 ------------
 + Vehicles (3) ------------------------------------------- [ + Add vehicle ]+
 | Vehicle   | Type        | Plate or USDOT        | Monthly rate | Status   |
 | Unit 7    | Combination | USDOT 2345678 . 8XYZ123 (CA) | $300.00 | Active |
 +---------------------------------------------------------------------------+
```

- Account card rules: "Owes" amount red when positive; "Customer credit" green when negative (show absolute value); zero neutral with label "Owes". Do not show a truck count here.
- If the ledger fails, show the error state in the card. Never show $0.00 as a fallback.
- Vehicles tab title includes the count from the vehicle list `total`. The table lists all active vehicles of every type with their current monthly rate or "Not set up".
- Transactions tab: one table of received and reversed payments and issued one-time charges, newest first, with filters (search reference, date range, type). Drafts never appear.
- Details tab: KeyValueList of every customer field, created and updated dates, and the Deactivate or Reactivate button at the bottom. Deactivating explains that the balance stays and payments can still be recorded.

### 7.5 Add and edit customer

- SectionCard "Customer" with icon tile: Type (Business or Individual, as two large radio cards), Display name, USDOT number (business only, digits only, helper "1 to 8 digits").
- InsetGroup "Contact": contact name (business only), phone, email.
- InsetGroup "Billing address": address line 1 and 2, city, state, postal code.
- SectionCard "Notes": multi-line notes.
- Edits send only changed fields with `If-Match`. On `412 STALE_VERSION`, show "Someone else changed this customer. Reload to see the latest, then make your change again." with a Reload button that keeps nothing silently.
- `409 USDOT_ALREADY_IN_USE` goes on the USDOT field.

### 7.6 Vehicle list

Data: `GET /vehicles?q=&include_inactive=&page=`.

Columns: Vehicle (unit number, plate, or USDOT as the title, linked), Owner (customer link), Type, Identifiers (USDOT, plate with state), Monthly rate (right aligned or "Not set up"), Status.

Search hint: "Unit number, plate, USDOT number, or customer name".

### 7.7 Add vehicle

```
Add vehicle

+ (truck icon) Vehicle --------------------------------------------------------+
| Customer *        [ Pacific Haul LLC                              v ]        |
| Vehicle type *    ( Truck ) ( Trailer ) ( Truck with trailer ) ( Compact car )|
| How is it identified? *   (o) USDOT number   ( ) License plate               |
| USDOT number *    [ 2345678 ]   (filled from the customer, can be changed)  |
| Unit number *     [        ]    "Tells apart trucks that share a USDOT"      |
| > More details (plate and state, optional)                                   |
+------------------------------------------------------------------------------+
+ (calendar icon) Monthly parking (optional) ----------------------------------+
|  +- InsetGroup -------------------------------------------------------------+ |
|  | Monthly amount (USD)   [ $ 300.00 ]   "Leave blank to set up later.     | |
|  |                                         Enter 0 for free parking."      | |
|  | Billing starts *       [ 2026-11-01 ]  (shown once an amount is typed)  | |
|  +--------------------------------------------------------------------------+ |
|  A monthly amount is not money owed. Charges are added only when you issue   |
|  monthly charges.                                                            |
+------------------------------------------------------------------------------+
                                                    [ Cancel ]  [ Add vehicle ]
```

- Rules from REQUIREMENTS 7.1: a plate needs its state; a vehicle needs a plate or a USDOT number; USDOT-only needs a unit number; USDOT is digits only. Warn (not block) when the vehicle USDOT differs from the customer's.
- Request: `POST /vehicles` with optional `parking: { starts_on, ends_on: null, monthly_rate, effective_on: starts_on, reason }` (BACKEND_REQUIREMENTS 6.4). One request, so a failed parking setup never leaves a vehicle behind.
- Errors: `PLATE_ALREADY_IN_USE` on plate, `UNIT_NUMBER_ALREADY_IN_USE` on unit number, `INVALID_PARKING` as a form-level error.
- After saving, return to where the user came from (customer page or vehicle list) with "Vehicle added."

### 7.8 Vehicle detail and edit

- Identity header: vehicle title, type, USDOT, status pill, owner link. The owner cannot be changed here (show a note).
- SectionCard "Monthly parking":
  - Current rate (large), service dates ("Nov 1, 2026 to No end date"), and a "Rate history and scheduled changes" table (Effective date, Rate, Reason).
  - First setup (any staff): Billing starts, Monthly amount, Reason.
  - Changing the rate or end date: admins only. Operators see the values read-only with "An admin must change the rate or end date." New rate needs a future effective date and a reason. Changing the end date opens a ConfirmDialog explaining that it does not remove existing charges.
- SectionCard "Vehicle details": the same fields as Add vehicle, sending only changes with `If-Match`.
- Deactivate vehicle at the bottom. `PARKING_STILL_ACTIVE` shows "End this vehicle's monthly parking before deactivating it."

### 7.9 Review monthly charges (dialog from customer account)

Data: `POST /billing-runs/preview`, then `POST /billing-runs/{id}/issue`.

1. "Bill through" date (defaults to today in the lot time zone, cannot be in the future).
2. Table of lines: Vehicle, Service dates, Days (for example "15 of 30 days"), Amount. Total at the bottom right. Show already billed count.
3. Checkbox "Apply $X of existing credit" (checked when credit exists) and the "Amount due after credit".
4. Plain sentence: "Issuing creates invoices. It does not record a payment."
5. "Issue charges" button. Disabled while sending.

Outcomes:
- Success: "Monthly charges issued. Outstanding balance updated." Refresh per section 9.
- `412 BILLING_PREVIEW_STALE` or `409`: "Something changed since this preview. Review the new preview."
- Timeout or 5xx: "We could not confirm whether the charges were issued. Check again before trying." The Check again button reuses the same `Idempotency-Key`. Do not let the user close and retry with a new key while the outcome is unknown.

### 7.10 Add one-time charge (dialog)

Fields: Description, Amount, Due date. Then a ReviewStep ("This adds a charge the customer owes. No payment is recorded."), then "Issue charge". Creates a draft with one key and issues it with a second key (BACKEND_REQUIREMENTS 6.8). Same unknown-outcome handling as 7.9.

### 7.11 Payments

List data: `GET /payments?q=&from=&to=&method=&status=&page=`.

- Table: Received (date), Customer (link), Method, Amount (right aligned), Status pill (Received or Reversed), "View receipt" action. Reference and notes appear only in the receipt dialog, not the list.
- Filters: search (customer or reference), date from and to, method, status. Advanced filters fold into a "Filters" button.

Record payment (dialog, from Overview, Payments, or Customer detail):
1. Customer (prefilled when opened from a customer), Amount received, Date received (not in the future), Method (Cash, Check, Bank transfer, Card paid elsewhere, Other), Reference (optional), Notes (optional).
2. ReviewStep with everything listed and "This records money you already received. It does not charge a card." Operators also see "Only an admin can reverse a payment."
3. "Confirm and record". Same idempotency and unknown-outcome rules as 7.9.

Receipt dialog: all payment fields, who recorded it and when, allocation and audit history. Admins see "Reverse payment", which needs a reason, explains "This fixes a wrong record. It is not a refund.", and uses `If-Match` plus an `Idempotency-Key`.

---

## 8. Plain language

Use these labels. Avoid the words on the right.

| Say (English) | Say (中文) | Avoid |
| --- | --- | --- |
| Owes | 未付余额 | Net balance, AR |
| Overdue | 逾期未付 | Past due receivable |
| Customer credit | 客户可抵扣余额 | Negative balance, unapplied funds |
| Monthly parking amount | 这辆车的月租金 | Rate plan, contract price |
| Not billed yet | 尚未开账单 | Unbilled parking accrual |
| Review monthly charges | 核对月租费用 | Run billing |
| Issue charges | 确认开账单 | Commit invoices |
| Record payment | 记录收款 | Post receipt |
| Add one-time charge | 添加一次性费用 | Manual debit |
| Deactivate | 停用 | Archive, delete |
| Problem number | 问题编号 | Request ID |

The Chinese labels above match the current app, so the parents see familiar words. Reuse the existing translations in `src/lib/i18n/locales/` where the meaning is unchanged. Have a native Chinese speaker review every new string before release. Chinese text may be shorter or longer than English, so never set fixed widths on buttons or labels.

---

## 9. Data and state rules

- TanStack Query for all server data. Do not copy API data into component state.
- One HTTP client in `src/lib/api`: cookies, `X-Requested-With: XMLHttpRequest`, JSON, error normalization to `{ code, message, request_id, field_errors }`, `If-Match` and `Idempotency-Key` options, 15 second timeout for financial writes.
- Generate types from `/openapi.json` when the backend publishes it. Until then, write types by hand from BACKEND_REQUIREMENTS section 6 and keep them in one folder per feature.
- Never show success before the server confirms it. No optimistic updates for money, invoices, or status changes.
- One idempotency key per intended operation, kept in a ref until the outcome is known, reused on retry.

### 9.1 What to refresh after each change

| Change | Invalidate query keys |
| --- | --- |
| Customer created or edited | `customers`, `overview`, that customer's detail |
| Customer deactivated or reactivated | `customers`, that customer's detail |
| Vehicle created | `vehicles`, `ledger` for its customer, `overview` |
| Vehicle edited or status changed | `vehicles`, that vehicle's detail |
| Monthly parking saved | that vehicle, `vehicles`, `ledger`, `overview` |
| Payment recorded or reversed | `payments`, `ledger`, `customers`, `overview` |
| Monthly charges issued | `ledger`, `payments`, `invoices`, `customers`, `overview` |
| One-time charge issued | `ledger`, `invoices`, `customers`, `overview` |
| Sign out or session expiry | Clear the whole cache |

### 9.2 Error handling by code

| Status or code | What the user sees |
| --- | --- |
| `401 SESSION_EXPIRED` | Go to sign in, then come back to the same page |
| `403 CSRF_REJECTED` | "Your request was blocked for safety. Reload the page and try again." plus problem number |
| `403 FORBIDDEN`, `ADMIN_REQUIRED` | "Only an admin can do this." on the action |
| `404 *_NOT_FOUND` | Not-found state with a link back to the list |
| `409` uniqueness codes | Message on the matching field |
| `412 STALE_VERSION` | Reload prompt, current data shown, user reviews and saves again |
| `422 VALIDATION_FAILED` | Field messages from `field_errors`, entered data kept |
| `429 RATE_LIMITED` | "Too many tries. Wait a minute and try again." |
| Network error, 5xx, timeout on a financial write | "We could not confirm this. Check before trying again." with a Check again button |
| Network error, 5xx on reads | ErrorState with Retry |

---

## 10. Accessibility checklist

Target WCAG 2.1 AA.

- Landmarks: `header`, `nav`, `main`, one `h1` per page, headings in order.
- Skip link "Skip to main content" as the first focusable element.
- Every input has a visible label, `aria-describedby` for helper and error text, and `aria-invalid` when invalid.
- Dialogs: accessible name from the title, focus moves in on open and returns to the trigger on close, Escape closes unless a financial request is in flight.
- Status changes (saved, failed, results count) are announced with a polite live region.
- Tables use `th scope="col"`. Sorting, if added, uses `aria-sort`.
- Test with keyboard only, with 200% browser zoom, and with a screen reader (NVDA or VoiceOver) on the core flow in section 12.

---

## 11. Project structure

```
src/
  app/            theme.ts, AppShell.tsx, Sidebar.tsx, TopBar.tsx, router.tsx, providers
  components/     PageHeader, FilterBar, DataTable parts, StatusPill, Money, KeyValueList,
                  SectionCard, InsetGroup, EmptyState, ErrorState, LoadingState,
                  ConfirmDialog, ReviewStep, form field wrappers
  features/
    auth/         sign in, session, RequireAuth, RequireRole
    overview/
    customers/
    vehicles/     includes monthly parking
    billing/      ledger, monthly charges, one-time charges
    payments/
    placeholders/ invoices, reports, settings, profile
  lib/            api client, errors, money, dates, i18n, queryClient
  hooks/          useListSearch (URL state), useOnlineStatus, useDebouncedValue
  mocks/          MSW handlers built from BACKEND_REQUIREMENTS, development and tests only
  test/           render helpers
```

- One component per file. `PascalCase` component files, `camelCase` utilities.
- Each feature has `api.ts` (calls and query keys), `types.ts`, `model.ts` (Zod schemas and mapping), page components, and colocated tests.
- Route-level code splitting with `React.lazy`.
- Mocks run only when `VITE_ENABLE_MOCKS=true` in development or the demo build. A production build with mocks must fail.

Stack (pinned versions, no new libraries without approval): React, TypeScript strict, Vite, React Router, TanStack Query, React Hook Form, Zod, MUI, i18next, MSW, Vitest, React Testing Library, user-event, Playwright, ESLint, Prettier.

---

## 12. Testing and acceptance

Core flow (must pass in English and Chinese, on a 1280px laptop and a 820px tablet):

1. Sign in.
2. Find or add a customer.
3. Add a vehicle with a monthly parking amount and billing start date.
4. Review and issue monthly charges.
5. Record a payment.
6. See the updated balance on the customer page, in the customer list, and on the Overview without reloading the browser.

Required financial example (REQUIREMENTS 17.1): two monthly charges of $200 and $250 issue a $450 invoice; a $300 payment leaves $150 owed, shown in red.

Tests to write:
- Unit: money parsing and formatting, date helpers, Zod form rules, error-code mapping.
- Component: every form's validation and server errors, each dialog's unknown-outcome path, role-based visibility, balance colors (red owed, green credit, neutral zero), empty and error states.
- Integration with MSW: the refresh table in 9.1 (each change updates the screens it affects).
- Playwright: the core flow above.
- Accessibility: `axe` checks on each page in component tests, plus the manual checks in section 10.

Definition of done for each screen: matches this file's layout, has all five states, works at all three widths in 4.3, all strings in both languages, tests pass, no lint or type errors.

---

## 13. Build order

| Phase | Deliver | Done when |
| --- | --- | --- |
| 1. Foundation | Vite project, theme tokens, i18n setup, HTTP client, error normalization, query client, MSW mocks from the contract | Theme renders a sample page; client tests pass |
| 2. Shell and components | Sidebar, top bar, responsive behavior, all section 5 components, a component gallery page in development only | Keyboard and zoom checks pass on the gallery |
| 3. Auth | Sign in, session check, sign out, route guards, session warning, offline banner | Sign-in errors and expiry work in both languages |
| 4. Customers | List, detail (account card, tabs), add, edit, deactivate | Customer screens complete with all states |
| 5. Vehicles and parking | List, add with optional monthly parking, detail with parking section and admin rules | Vehicle and parking rules from REQUIREMENTS 7.1 and 7.2 enforced in the UI |
| 6. Money | Record payment, receipts, reverse, review monthly charges, one-time charges, refresh table | Financial example in section 12 passes end to end |
| 7. Overview | Six KPIs with correct colors and time context | Updates after every money change without a browser reload |
| 8. Placeholders and polish | Invoices, Reports, Settings, Profile placeholders, not-found page, Chinese review, accessibility pass | Section 12 acceptance passes |

After each phase: run typecheck, lint, tests, and build, and report what ran.

---

## 14. Open questions for the owner

1. Should balance colors also apply to individual invoice rows when invoice pages are built (red for unpaid past due only, or all unpaid)?
2. Do the owners want a printed customer statement in MVP 1 before the PDF endpoint exists (browser print of the customer page)?
3. Is there a logo file? If not, use a simple "O" mark in a white rounded square.
4. Should the sidebar show the lot name or the business name?

---

## 15. Prompt for a coding agent

Paste this, with this file and the linked specs attached:

> Build a new React + TypeScript frontend for OceanLink, a truck parking lot billing app, from scratch in this repository. Follow `.github/UX_REBUILD.md` for the look, layout, screens, and build order, and treat `.github/REQUIREMENTS.md` and `.github/BACKEND_REQUIREMENTS.md` as the source of truth for business rules and the API. Build MVP 1 only. The main goal is readability for non-technical users: 16px base text, high contrast, no pale gray text, one clear primary action per screen, plain labels in English and Simplified Chinese. Use the blue sidebar shell and data-table style of reference A and the large page titles, icon-tile form cards, and tinted grouped fields of reference B, as described in section 2. Use only the approved stack. Do not invent endpoints, fields, or business rules. Never show a financial success before the server confirms it. Work phase by phase from section 13, and after each phase run typecheck, lint, tests, and build, then report what changed, what ran, and anything blocked.

---

## 16. Implementation notes (2026-10-31 build)

The frontend was built from this document. Where the build differs, this is why:

- **USDOT for individuals.** Section 7.5 shows the USDOT field for businesses only. Owner-operators (individuals) also have USDOT numbers in the real data, so the field is shown for both types.
- **Customer list contact column.** Shows contact name, phone, and email on separate lines; phone is a tap-to-call link.
- **Transactions filters.** The customer Transactions tab has search and a "Show" filter (everything, payments only, charges only). The date range filter was left out to keep the tab simple; the Payments page has the full date filters.
- **Invoice source names.** The Transactions tab needs `source_type` on every invoice, so `GET /invoices` without `source_type` returns all issued invoices. Logged in BACKEND_LOGIC_CHANGES.md.
- **"Owes after issuing" in Review monthly charges.** Applying credit does not change the net amount owed (it only moves credit onto the new invoices), so this number does not change when the credit box is ticked.
- **Automatic payment allocation (owner approved 2026-10-31).** Recording a payment applies it to the customer's oldest unpaid issued invoices first, ordered by due date, issue date, then ID. Any remainder stays as customer credit. The account, customer list, and Overview refresh with reduced unpaid balances; reversing the payment restores them. Existing credit can still be applied when issuing monthly charges.
- **Dashboard global search.** Search customers, vehicles, and payments from the Overview. Search is debounced 300ms and saved as `?q=` in the URL; Enter (the phone keyboard's Search key) searches at once and puts the keyboard away, Escape clears, and `/` focuses the box from anywhere on the dashboard. While a query is active the dashboard cards hide and a single results panel takes their place: a summary line ("4 matches for ..."), filter buttons for All, Customers, Vehicles, and Payments with counts (kept in the URL as `?in=`), and only the groups that have matches, side by side on desktop and stacked on phones. Each result is a full-width row with the matched text highlighted, the record's key facts, an Inactive pill where relevant, and a payment amount with a receipt action. "Show all N matches" appears only when a group is truncated at five. A single empty state suggests other identifiers and offers "Add customer". Include inactive customers and vehicles. Loading and retryable error states are per group. Use the existing list APIs, not a new search endpoint.
- **Mock demo sessions survive a page reload** so a demo does not sign people out. Tests keep strict isolation.
- **Not done yet:** Playwright end-to-end tests and automated `axe` checks (both need new dev dependencies, which need approval), and a screen-reader pass with NVDA or VoiceOver. Keyboard, focus, labels, landmarks, skip link, and contrast are built in and partly covered by tests.
