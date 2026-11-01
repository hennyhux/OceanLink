# UX Code Review: Findings for Decision

Date: 2026-11-01. Scope: everything under `src/` except the mock backend (about 10,000 lines of UI code), checked in English and Chinese at desktop and phone widths.

Tick **Fix** for the items you want done. Each fix will get a regression test.

How each finding was checked:

- **Browser**: reproduced in the running app (mock mode).
- **Code**: found by reading the code; the steps to reproduce are given.

Effort: S = under an hour, M = half a day, L = a day or more.

## Summary

| #   | Fix | Severity  | Area                    | Finding                                                         | Checked | Effort |
| --- | --- | --------- | ----------------------- | --------------------------------------------------------------- | ------- | ------ |
| 1   | [ ] | 🟠 High   | One-time charge         | Issue button stops working after a failure; duplicate drafts    | Code    | S      |
| 2   | [ ] | 🟠 High   | Dialogs on phones       | Charges table hides Days and Amount above "Issue charges"       | Browser | M      |
| 3   | [ ] | 🟡 Medium | Payments, Vehicles list | A page number past the end shows an empty list with no way back | Browser | S      |
| 4   | [ ] | 🟡 Medium | Payments list           | Opening or closing "Record payment" jumps to page 1             | Code    | S      |
| 5   | [ ] | 🟡 Medium | Customer transactions   | History silently stops at 100 items; filter dead end            | Code    | S      |
| 6   | [ ] | 🟡 Medium | Payments list (phone)   | Every receipt button has the same name for screen readers       | Code    | S      |
| 7   | [ ] | ⚪ Low    | Vehicle detail          | A parking edit conflict wipes typing in the details form        | Code    | S      |
| 8   | [ ] | ⚪ Low    | Receipt                 | Old reversal error stays on screen after Back                   | Code    | S      |
| 9   | [ ] | Improve   | Customer picker         | Show Inactive label and phone so the right customer is picked   | Code    | S      |
| 10  | [ ] | Improve   | Payments list           | Show the payment reference (search already matches on it)       | Code    | S      |
| 11  | [ ] | Improve   | Payments filters        | Catch a From date later than the To date                        | Code    | S      |
| 12  | [ ] | Improve   | Phone filter bars       | Fold filters behind a "Filters (n)" button                      | Code    | M      |
| 13  | [ ] | Improve   | Top bar                 | Global search from any page, not just the Overview              | Code    | M      |
| 14  | [ ] | Improve   | Sidebar                 | Mark Invoices and Reports as not available yet                  | Code    | S      |
| 15  | [ ] | Improve   | Pagers                  | Scroll to the top of the list after changing pages              | Code    | S      |
| 16  | [ ] | Improve   | Vehicle detail          | Stay on the page after saving details                           | Code    | S      |
| 17  | [ ] | Improve   | Unsaved changes guard   | Leave-page warning also works in older Safari                   | Code    | S      |

---

## Broken

### 1. One-time charge: Issue button stops working after a failure, and drafts can be duplicated

- **Where:** [OneTimeChargeDialog.tsx](../src/features/billing/OneTimeChargeDialog.tsx), `issue()`
- **What happens:** On any failure that is not "unknown outcome" (a validation error, a 500, and so on), the code sets `operation.current = null`. The dialog stays on the review step with **Issue charge** still enabled, but `issue()` returns straight away because `operation.current` is now empty. The button does nothing and gives no feedback.
- **Second problem:** Issuing has two steps: create a draft, then issue it. If the draft was created and only the issue step failed, the draft is thrown away on the client. Going Back and then Review again creates a **second draft** for the same charge. The first one is left behind on the server.
- **Reproduce:** Make `POST /invoices/{id}/issue` return 500, then click Issue charge twice.
- **Suggested fix:** On a definite failure, keep the request body and any draft that was created. Issue a fresh key only for the step that failed. Only drop the operation when the user goes Back and changes something.

### 2. Monthly charges table is cut off on phones

- **Where:** [MonthlyChargesDialog.tsx](../src/features/billing/MonthlyChargesDialog.tsx). Also affects every dialog: none of the 8 use `fullScreen` on small screens ([RecordPaymentDialog.tsx](../src/features/payments/RecordPaymentDialog.tsx), [ReceiptDialog.tsx](../src/features/payments/ReceiptDialog.tsx), [OneTimeChargeDialog.tsx](../src/features/billing/OneTimeChargeDialog.tsx), [ParkingSection.tsx](../src/features/vehicles/ParkingSection.tsx), [ConfirmDialog.tsx](../src/components/ConfirmDialog.tsx), [UnsavedChangesGuard.tsx](../src/components/UnsavedChangesGuard.tsx), [SessionKeeper.tsx](../src/features/auth/SessionKeeper.tsx)).
- **What happens (browser):** On a phone, the 4-column table needs about 2.6 times the dialog's width (358px of content in a 137px area). Only "Vehicle" and part of "Service dates" are visible. **Days and Amount are hidden** behind a sideways scroll inside the dialog, while **Issue charges** sits right below. Staff confirm money they cannot see.
- **Suggested fix:** Make money dialogs full screen below the `sm` breakpoint. On phones, show the charges as stacked rows (vehicle and amount on one line, dates and days below) instead of a table. Keep the table on desktop.

### 3. A page number past the end leads to an empty list with no way back

- **Where:** [PaymentsPage.tsx](../src/features/payments/PaymentsPage.tsx), [VehiclesPage.tsx](../src/features/vehicles/VehiclesPage.tsx). [CustomersPage.tsx](../src/features/customers/CustomersPage.tsx) already handles this.
- **What happens (browser):** `/payments?page=99` shows "1 payment" above an empty list. There is no pager, because there is only one page, so there is no way back except clearing the URL. This happens after a bookmark, the Back button, or a filtered list getting shorter.
- **Suggested fix:** Copy the Customers effect that resets to page 1 (`if (data.total > 0 && data.items.length === 0) setPage(1)`), or move it into `useListSearch` so every list gets it.

### 4. Opening "Record payment" resets the Payments list to page 1

- **Where:** [PaymentsPage.tsx](../src/features/payments/PaymentsPage.tsx) uses `search.setFlag('record', …)`. [useListSearch.ts](../src/hooks/useListSearch.ts) `setFlag` always clears `page`.
- **What happens:** On page 3 of the payments list, opening or cancelling the Record payment dialog sends the list back to page 1.
- **Suggested fix:** Give the hook a way to set a URL value without touching the page number, and use it for the `record` flag. Real filters should still reset to page 1.

### 5. Customer transactions silently stop at 100 items, and a filter can leave a dead end

- **Where:** [CustomerTransactionsTab.tsx](../src/features/customers/CustomerTransactionsTab.tsx)
- **What happens:**
  - It loads at most 100 payments and 100 invoices (`page_size: 100`) and says nothing when there are more. Long-time customers see an incomplete history that looks complete.
  - When the search box or the "Show" filter matches nothing, it says "No transactions to show", the same text as a brand-new customer, with no way to clear the filter.
- **Suggested fix:** When `total > items.length` for either list, show a note like the Overview's "showing the first 100" note. Show "No transactions match" with a **Clear filters** button when a filter is active.
- **Later:** a combined, paged `/customers/{id}/transactions` endpoint would remove the limit. This would need a backend change.

### 6. Phone payment list: every receipt button reads the same to screen readers

- **Where:** [PaymentsPage.tsx](../src/features/payments/PaymentsPage.tsx), the phone list
- **What happens:** The desktop table uses `payments.viewReceiptFor` ("View receipt for {name}"). The phone cards render a plain "View receipt" for every row, so a screen reader's list of buttons is just "View receipt" over and over.
- **Suggested fix:** Use the same `aria-label` as desktop, or better, make the whole card open the receipt (like `RecordCard`).

### 7. A parking edit conflict wipes unsaved typing in the vehicle details form

- **Where:** [VehicleDetailPage.tsx](../src/features/vehicles/VehicleDetailPage.tsx), where `ParkingSection` gets `onStale={reload}`
- **What happens:** `reload()` refetches **and** increments the details form's key, which remounts it. If a parking change hits an edit conflict (412) while the user has unsaved edits in the details form below, those edits are lost.
- **Suggested fix:** For parking conflicts, refetch only. `ParkingSection` already remounts by itself when the vehicle version changes. Keep the form reset for conflicts that come from the details form.

### 8. Receipt: an old reversal error stays visible after Back

- **Where:** [ReceiptDialog.tsx](../src/features/payments/ReceiptDialog.tsx)
- **What happens:** After a failed reversal (for example "Could not save"), pressing **Back** returns to the plain receipt but the red error stays on screen. It looks like the receipt itself is broken.
- **Suggested fix:** Clear the error (`setProblem(null)`) and reset the reason form when leaving reversal mode.

---

## Improvements

### 9. Customer picker: show an Inactive label and the phone number

- **Where:** [CustomerPicker.tsx](../src/features/customers/CustomerPicker.tsx)
- **Why:** The Record payment picker includes inactive customers (`includeInactive`), but the options only show the name, type, and USDOT. Two customers with similar names, or an archived duplicate, look the same. Staff can record money against the wrong account.
- **Suggestion:** Add the `StatusPill` "Inactive" label and the phone number to each option.

### 10. Show the payment reference in the Payments list

- **Where:** [PaymentsPage.tsx](../src/features/payments/PaymentsPage.tsx)
- **Why:** The search box is labelled "Customer or reference" and matches on the reference, but neither the table nor the phone cards show it. Staff can't see why a row matched or tell two same-day payments apart.
- **Suggestion:** Add a Reference column on desktop and put it in the date line on phone cards.

### 11. Catch a From date later than the To date

- **Where:** [PaymentsPage.tsx](../src/features/payments/PaymentsPage.tsx) filter bar
- **Why:** Choosing From = Nov 10 and To = Nov 1 silently returns "No payments match".
- **Suggestion:** Set `max` on From to the To date and `min` on To to the From date, and show a short error if the range is backwards.

### 12. Fold the filters on phones

- **Where:** [FilterBar.tsx](../src/components/FilterBar.tsx); mostly affects Payments (5 fields) and Customers/Vehicles (search plus 2 checkboxes)
- **Why:** On a phone the Payments filter bar is taller than the screen, so the list starts below the fold.
- **Suggestion:** Below `sm`, show the search box plus a **Filters (n)** button that opens the other fields in a bottom drawer or collapse.

### 13. Global search from any page

- **Where:** [TopBar.tsx](../src/app/TopBar.tsx)
- **Why:** Global search only lives on the Overview. Staff on a customer page who need to find another truck must go back to the Overview first.
- **Suggestion:** Add a compact search box to the top bar on desktop (a search icon on phones) that opens `/?q=…`. `/` already focuses the search box on the Overview; it could do the same everywhere.

### 14. Mark placeholder pages in the sidebar

- **Where:** [navigation.ts](../src/app/navigation.ts), [Sidebar.tsx](../src/app/Sidebar.tsx)
- **Why:** Invoices and Reports look like working pages but only show "not available yet".
- **Suggestion:** Add a small "Soon" label to them (or hide them) until their APIs exist.

### 15. Scroll to the top of the list after changing pages

- **Where:** [ListCard.tsx](../src/components/ListCard.tsx) `Pager`
- **Why:** The bottom pager changes the page but leaves the scroll position at the bottom. On phones, staff land at the end of the new page.
- **Suggestion:** After a page change, scroll the list card's heading into view and move focus to it.

### 16. Stay on the vehicle page after saving details

- **Where:** [VehicleDetailPage.tsx](../src/features/vehicles/VehicleDetailPage.tsx)
- **Why:** The details form is part of the vehicle's own page, but saving sends the user back to the list. Often the next step is on the same page (for example, setting up parking).
- **Suggestion:** Stay on the page, show the "Saved" message, and reset the form to the saved values. Customers can stay as it is, because its edit form is a separate page.

### 17. Make the leave-page warning work in older Safari

- **Where:** [UnsavedChangesGuard.tsx](../src/components/UnsavedChangesGuard.tsx)
- **Why:** The `beforeunload` handler only calls `preventDefault()`. Safari before 17 and some embedded browsers also need `event.returnValue = ''` to show the "Leave site?" prompt.
- **Suggestion:** Set both.

---

## Working correctly

These were checked and need no change:

- A payment, charge, or billing run is never recorded twice when the result is unknown. The dialog stays locked and the button becomes **Check again**, using the same key.
- Edit conflicts (412) on the customer and vehicle forms show "Reload" and never wipe typing on a background refresh.
- The unsaved-changes prompt appears when leaving a changed form for another page.
- The session timeout warning and keep-alive.
- "Show all details" on a customer page brings the Details tab into view on phones.
- Dashboard global search: grouped results, filters, keyboard shortcuts, partial-failure handling, and phone layout.
