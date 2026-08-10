# dashSpend

A lean, functional frontend for the Expense Reimbursement API. Employees
record monthly expenses with receipts and submit reimbursement requests;
managers review, approve or reject with comments, and see departmental
summaries and FX rate admin.

Built with Vite + React + TypeScript + Tailwind v4. Money renders in mono
tabular digits; one accent (pine green); light/dark themes via CSS tokens.

## Run it

The API must be running on `http://localhost:8000` (see the
`expense-reimbursement` repo for setup).

```bash
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:8000` (vite.config.ts).
The backend has no CORS middleware, so the proxy is required in development;
for production, either enable CORS on the backend or serve the built app
behind the same origin as the API.

Demo accounts (seeded by `seed.py`, password `password123`):

| Email | Role |
| --- | --- |
| `employee@example.com` | Employee (Engineering) |
| `manager@example.com` | Manager (Engineering) |
| `finemployee@example.com` | Employee (Finance) |
| `finmanager@example.com` | Manager (Finance) |

## What is implemented

- OAuth2 password login, JWT stored locally, `/users/me` drives the whole UI.
  401 anywhere clears the session and bounces to login.
- Expenses: list with search (debounced), category/status/currency/period
  filters, pagination via Load more. Create, edit, delete drafts. Receipt
  upload (PDF/PNG/JPG, magic-byte errors surfaced verbatim), download, delete.
  Submitted expenses are read-only; editing one surfaces the 409 message and
  reloads the entity.
- Submit flow: pick a month, see your drafts and per-currency totals, submit.
  The button disables when a pending request already exists for that month;
  409 and 422 `missing_fx_rate` messages are shown verbatim (managers get a
  link to FX admin via the message text).
- Requests: employee tracker, shared detail page with the immutable expense
  snapshot, totals in original and base currency, audit history, reject
  banner with the decision comment and a resubmit action. Receipts attached
  to expenses are listed on the detail page and downloadable by
  same-department managers (the request payload now carries receipt
  metadata via `ExpenseBrief.receipts`).
- Manager: review queue (pending, department-scoped), approve/reject with
  comment, approved archive with period filter, departmental summary
  (approved totals, status counts, category and currency breakdowns).
- FX rates: read-only table for employees; add/update rates for managers.
- Both themes (light/dark) follow system preference with a manual toggle;
  `prefers-reduced-motion` disables all animation.

## Known API gaps the UI works around

- `ReimbursementRequestOut` does not include the employee's name, so manager
  screens identify requests by period/date only. If reviewer identity
  matters, the backend should add `employee_name` to that schema.
- There is no way to delete an expense for managers, so the delete affordance
  is hidden for that role on the expense modal.
- The backend has no `GET /reimbursement-requests/{id}/audit` route (only
  `GET /expenses/{id}/audit`). The request detail Activity panel therefore
  aggregates the audit trails of the request's expenses (deduped, newest
  first) instead. If the backend adds the endpoint, the panel will prefer it
  automatically (`src/components/AuditPanel.tsx`).

## Notes

- All money is handled as strings; sums use integer-cents math
  (`src/lib/money.ts`). Never `parseFloat` a balance in this codebase.
- Mirror the wire types from `base.md` in `src/api/types.ts`; regenerate from
  `/openapi.json` if the API changes.
- Error handling pattern: always surface `detail.message` verbatim
  (`src/api/client.ts` throws `ApiError` with code + message + per-field
  errors).