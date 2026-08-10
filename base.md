# Backend Guide for Frontend Developers

Everything a frontend team needs to integrate with the Expense Reimbursement
API: auth, wire contracts, exact JSON shapes, state machines the UI must
render, and screens mapped to endpoints.

**Base URL**: `http://localhost:8000` · API prefix: `/api/v1` ·
Live interactive docs (Swagger): `http://localhost:8000/docs` ·
OpenAPI spec: `http://localhost:8000/openapi.json` (can be fed to
OpenAPI-Generator / Orval / openapi-typescript).

---

## 1. First principles (read this before anything)

1. **All money values are strings, not numbers.** `amount`, `base_amount`,
   `fx_rate_to_base`, `rate` come back as JSON strings (e.g. `"42.50"`,
   `"126.31578947"`). Never do arithmetic on them client-side without parsing
   to a decimal type; when sending values back, send them as strings too
   (`"42.50"`, not `42.5` — the API rejects more than 2 decimal places for
   expenses).
2. **All dates/times are ISO 8601 strings**: `"2025-06-10"` (date),
   `"2025-06-10T14:32:11.123456+00:00"` (datetime). Never ship unparsed
   formats; use the browser's `Date`/`Intl` for display.
3. **Pagination is always the same envelope** (see §4).
4. **Errors are always the same envelope** (see §5).
5. **Auth token is a JWT that expires in 60 minutes.** Plan for 401 handling
   and re-login (see §2).

Demo users (from `seed.py`): `employee@example.com` / `manager@example.com` /
`finemployee@example.com` / `finmanager@example.com`, password `password123`.

---

## 2. Authentication flow

Auth is the **OAuth2 password flow** (form-encoded, NOT JSON):

```http
POST /api/v1/auth/token
Content-Type: application/x-www-form-urlencoded

username=employee@example.com&password=password123
```

Response:

```json
{ "access_token": "eyJhbGciOiJIUzI1NiIs...", "token_type": "bearer" }
```

- Send it on every other request as `Authorization: Bearer <token>`.
- The token contains the user id (`sub`) and expires after **60 minutes**.
- On `401` (invalid/expired token), clear session and redirect to login. A
  common pattern: an interceptor that retries once after re-login, then bounces.
- After login, fetch the profile to drive the whole UI:
  `GET /api/v1/users/me` →

```json
{
  "id": 3,
  "email": "manager@example.com",
  "full_name": "Marcus Manager",
  "role": "manager",
  "department_id": 1,
  "department_name": "Engineering"
}
```

`role` is `"employee"` or `"manager"` — **this one field decides which screens
the user sees** (§8).

---

## 3. Data types cheat-sheet

| Concept | Wire type | Example | Notes |
|---|---|---|---|
| Money (`amount`, `base_amount`) | string | `"42.50"` | up to 2 dp; parse with a decimal lib for math |
| FX rate | string | `"0.95"` | up to 8 dp, units of currency per 1 USD |
| Date | string | `"2025-06-10"` | `YYYY-MM-DD`, never in the future |
| Datetime | string | `"2025-06-10T14:32:11+00:00"` | ISO 8601 |
| Period | string | `"2025-06"` | `YYYY-MM` regex `^\d{4}-(0[1-9]|1[0-2])$` |
| Currency | string | `"EUR"` | ISO 4217, 3 uppercase letters; fixed list (see `/docs`) |
| Category | string | `"Meals"` | fixed list: Travel, Meals, Lodging, Office Supplies, Software, Transport, Entertainment, Other |
| Status | string | `"draft"` | see state machines §7 |
| Role | string | `"manager"` | `employee` \| `manager` |

---

## 4. Pagination envelope

Every list endpoint returns the same shape:

```json
{
  "items": [ /* T[] */ ],
  "total": 47,
  "page": 2,
  "page_size": 25
}
```

Query params for every list: `page` (≥ 1, default 1), `page_size` (1–100,
default 25). `total` is the number of matching rows (not pages). Compute pages
as `Math.ceil(total / page_size)` — or ignore and use "Load more" with `page+1`
until `items` is empty.

---

## 5. Error envelope

All errors (including auth and validation):

```json
{ "detail": { "code": "conflict", "message": "a pending reimbursement request (id=3) already exists for 2025-06; ..." } }
```

Validation errors additionally include an `errors` array with per-field info:

```json
{
  "detail": {
    "code": "validation_error",
    "message": "request validation failed",
    "errors": [ { "type": "greater_than", "loc": ["body", "amount"], "msg": "Input should be greater than 0", ... } ]
  }
}
```

**Status codes and how the UI should react:**

| Status | `code` | When | UI reaction |
|---|---|---|---|
| 401 | `unauthorized` | bad credentials, missing/invalid/expired token | login form error / redirect to login |
| 403 | `forbidden` | manager acting outside own department, employee hitting a manager endpoint | hide the action; show "not allowed" |
| 404 | `not_found` | truly missing, **or exists but not yours** (no existence leak) | show "not found or no access" |
| 409 | `conflict` | state-machine violation — editing a submitted expense, **duplicate pending request**, deciding a non-pending request | refresh the entity; show inline message with the `message` text |
| 422 | `validation_error`, `invalid_input`, `missing_fx_rate` | malformed input, unknown category/currency, **submission when a currency has no FX rate** | map `errors[]` to form fields; link to FX admin for `missing_fx_rate` |

Rule of thumb: **always surface `detail.message` verbatim** — it is
human-readable and precise.

---

## 6. Endpoints — full contracts

### 6.1 Auth & profile

| Method | Path | Auth | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/auth/token` | none | form: `username`, `password` | `TokenResponse` |
| GET | `/users/me` | any | — | `UserOut` (§2) |

### 6.2 Expenses — `POST/GET /api/v1/expenses`

**Create** (`POST` → 201):

```json
// request
{
  "category": "Meals",
  "amount": "42.50",
  "currency": "USD",
  "occurred_at": "2025-06-10",
  "description": "Client dinner",
  "vendor": "La Trattoria"
}
// response (ExpenseOut)
{
  "id": 7,
  "category": "Meals",
  "amount": "42.50",
  "currency": "USD",
  "occurred_at": "2025-06-10",
  "description": "Client dinner",
  "vendor": "La Trattoria",
  "status": "draft",
  "request_id": null,
  "fx_rate_to_base": null,
  "base_amount": null,
  "converted_at": null,
  "created_at": "2025-06-10T10:00:00+00:00",
  "receipts": []
}
```

Note: `vendor` is optional; `status` starts `"draft"`; FX fields are `null`
until the expense is submitted (§7).

**List** (`GET /expenses`) — all query params optional:

```
page, page_size
period=2025-06        # YYYY-MM filter on occurred_at
from_date=2025-06-01  # inclusive
to_date=2025-06-30    # inclusive
category=Meals        # exact
status=draft|submitted
currency=EUR# exact
min_amount / max_amount
q=flight              # case-insensitive substring on description/vendor
```

Returns `Page<ExpenseOut>`.

**Update** — `PATCH /expenses/{id}`. Partial: send only changed fields. Only
works on `draft` expenses (else 409). Example:

```json
{ "amount": "45.00", "vendor": "La Trattoria (updated)" }
```

**Delete** — `DELETE /expenses/{id}` → 204 (no body). Draft only.

**Get one** — `GET /expenses/{id}` → `ExpenseOut`.

### 6.3 Receipts

A receipt is a file attached to an expense (pdf / png / jpg / jpeg, ≤ 5 MB).
Bytes are checked against their extension (**magic-byte sniffing** — a renamed
`.exe` is rejected), so do not rename files client-side.

**Upload** — `POST /expenses/{id}/receipts`, **`multipart/form-data`**, field
name **`file`** → 201 `ReceiptOut`:

```json
{
  "id": 12,
  "filename": "dinner-receipt.pdf",
  "content_type": "application/pdf",
  "size_bytes": 48213,
  "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "uploaded_at": "2025-06-10T10:05:00+00:00"
}
```

Draft expense only (409 otherwise). Receipts appear inside each expense's
`receipts[]` when listing.

**Download** — `GET /expenses/{id}/receipts/{receipt_id}` → raw bytes with
`Content-Type` matching the file and `Content-Disposition: attachment;
filename="..."`. Open in a new tab or fetch as a blob for a lightbox/preview.
Access: owner **or same-department manager**.

**Delete** — `DELETE /expenses/{id}/receipts/{receipt_id}` → 204. Draft only.

### 6.4 Audit trail

`GET /expenses/{id}/audit` and `GET /reimbursement-requests/{id}/audit`
(owner or same-dept manager) → a **list, newest first**:

```json
[
  {
    "id": 55,
    "occurred_at": "2025-06-10T11:02:00+00:00",
    "actor_id": 1,
    "actor_role": "employee",
    "action": "expense.submitted",
    "before": { "category": "Meals", "amount": "42.50", "status": "draft" },
    "after":  { "category": "Meals", "amount": "42.50", "status": "submitted" },
    "comment": null
  }
]
```

`action` values you may see: `expense.created`, `expense.updated`,
`expense.deleted`, `receipt.attached`, `receipt.deleted`,
`expense.submitted`, `expense.reverted_to_draft`, `request.submitted`,
`request.approve`, `request.reject`, `fx_rate.created`, `fx_rate.updated`.
Use this for an activity/history panel. `before`/`after` are JSON snapshots
(money as strings, dates as ISO).

### 6.5 Reimbursement requests

**Submit** — `POST /reimbursement-requests`:

```json
{ "period": "2025-06", "expense_ids": [7, 8] }
```

`expense_ids` is optional — omit to include **all** your draft expenses that
month. The employee's draft expenses in that period become `submitted`, FX is
snapshotted onto each, and the request becomes `pending`. → 201
`ReimbursementRequestOut`:

```json
{
  "id": 4,
  "employee_id": 1,
  "period": "2025-06",
  "status": "pending",
  "submitted_at": "2025-06-10T11:02:00+00:00",
  "decided_at": null,
  "decision_comment": null,
  "decided_by": null,
  "expense_snapshot": [ { "id": 7, "category": "Meals", "amount": "42.50", "currency": "USD", "description": "Client dinner", "vendor": "La Trattoria" } ],
  "expenses": [
    { "id": 7, "category": "Meals", "amount": "42.50", "currency": "USD", "base_amount": "42.50", "occurred_at": "2025-06-10" }
  ]
}
```

**Fails with 409** if the employee already has a `pending` request for that
period (UI: disable the submit button when one exists — see §7). **Fails with
422 `missing_fx_rate`** if any included currency lacks a rate (only matters for
non-USD currencies; see §7.3).

**List** — `GET /reimbursement-requests`:

```
page, page_size
period=2025-06      # YYYY-MM
status=pending|approved|rejected
employee_id=5       # manager view: filter a specific employee (own dept only)
department_id=2     # manager view: filter by department (own dept only)
```

**Employees see only their own** requests (any filter combo is ignored for
employees — always scope client-side by `employee_id === me.id`).
Returns `Page<ReimbursementRequestOut>`.

**Get one** — `GET /reimbursement-requests/{id}` → `ReimbursementRequestOut`
(owner or same-dept manager).

**Decision (manager)** — `POST /reimbursement-requests/{id}/decision`:

```json
{ "action": "approve", "comment": "Looks good" }
```

`action`: `"approve"` | `"reject"` (reject **reverts the expenses to draft** —
see §7). `comment` optional (≤ 1000 chars), shown in the response and audit.
→ `ReimbursementRequestOut`. 409 if the request is not `pending` (someone else
decided first).

**Approved archive (manager)** — `GET /reimbursement-requests/approved`:
same filters minus `status`; scope is the **manager's own department**.

**Departmental summary (manager)** — `GET /reimbursement-requests/summary`:

```
?period=2025-06&department_id=2    # department_id optional, own dept only
```

```json
{
  "period": "2025-06",
  "department_id": 1,
  "total_requests": 3,
  "counts_by_status": { "pending": 1, "approved": 1, "rejected": 1 },
  "total_approved_base_amount": "184.21",
  "approved_by_category": [ { "category": "Meals", "total": "42.50" } ],
  "approved_base_by_currency": [ { "currency": "EUR", "total": "126.32" } ],
  "approved_original_by_currency": [ { "currency": "EUR", "total": "120.00" } ]
}
```

Frontend notes: `total_approved_base_amount` and the `approved_*` totals are in
**base currency (USD)**; `approved_original_by_currency` is in each original
currency. Render a "requested vs approved" bar from `counts_by_status`, a
category breakdown from `approved_by_category`.

### 6.6 FX rates

**List** — `GET /fx-rates` → array of `FxRateOut` (all historical rows unless
filtered):

```json
[
  { "id": 2, "currency": "EUR", "base_currency": "USD", "rate": "0.92", "effective_date": "2024-01-01" }
]
```

Query: `currency=EUR` and/or `as_of=2025-06-10` (returns the **latest rate per
currency effective on or before** that date — what submission actually uses).

**Upsert (manager)** — `PUT /fx-rates/{currency}`:

```json
{ "rate": "0.95", "effective_date": "2025-06-01" }
```

Creates or updates that exact `(currency, effective_date)` point.
`rate` = units of currency per 1 USD; up to 8 decimal places.

---

## 7. State machines & the rules the UI must enforce

### 7.1 Expense lifecycle

```
         create/attach receipt/attach receipt
            ▼
        ┌────────┐   submit request   ┌────────────┐
        │ draft  │ ─────────────────▶ │ submitted  │
        └────────┘                    └────────────┘
           ▲  edit/delete/receipts          │
           │  allowed here ONLY             │ reject (by manager)
           └────────────────────────────────┘
```

UI rules:
- `draft` → show **Edit**, **Delete**, **Add receipt** buttons.
- `submitted` → read-only, show the request chip ("Pending approval" /
  "Approved"); if you call edit/delete/receipt APIs you'll get **409**.
- `request_id` links the expense to its request; FX fields (`fx_rate_to_base`,
  `base_amount`, `converted_at`) are populated once submitted — show the
  original amount and (for managers) the converted base amount.

### 7.2 Request lifecycle

```
  employee          manager             consequence
  submit ──▶ pending ──approve──▶ approved   (terminal; money committed)
                │
                └──reject──▶ rejected (request is terminal, BUT expenses
                                        revert to draft; employee edits
                                        and can submit a NEW request
                                        for the same month)
```

UI rules:
- **pending**: employee sees "Awaiting review"; manager sees **Approve /
  Reject** + comment box. Only one pending request per employee-month is
  allowed → **hide/disable the "Submit for period X" button if a pending
  request for X exists** (fetch list with `status=pending` once per period).
- **approved**: read-only everywhere; appears in manager "Approved" archive.
- **rejected**: request is read-only (shows `decision_comment` — surface it
  prominently, e.g. "Rejected: missing hotel invoice"), but the employee's
  expenses are editable again and re-submittable for the same month.
- `expense_snapshot` (`JSON` array with id/category/amount/currency/
  description/vendor) is the **immutable record of what was submitted** — use
  it for the request detail page so history survives rework.

### 7.3 Multi-currency behavior to communicate

- Expenses keep the **original amount + currency**; the system converts to USD
  **at submission time** using the rate effective on that day.
- On the submit response, each expense has `base_amount` — show "≈ $X in USD
  (rate 0.95, 2025-06-10)" as a tooltip for non-USD lines.
- If a currency has **no rate**, submitting returns 422 `missing_fx_rate`
  naming the currency → UI: "Add rates for EUR in the FX admin before
  submitting" (manager role can create rates via §6.6).
- USD needs no rate row (rate = 1).

---

## 8. Role-based screens (map to endpoints)

| Screen | Employee | Manager |
|---|---|---|
| Login | `POST /auth/token` | same |
| Expense list + filters/search | `GET /expenses` | own expenses only (`GET /expenses`) |
| Expense edit / receipts / delete | `POST/PATCH/DELETE /expenses*` (drafts) | — |
| Submit reimbursement | `POST /reimbursement-requests` | — |
| My request tracker | `GET /reimbursement-requests` (auto-scoped) | — |
| Review queue | — | `GET /reimbursement-requests?status=pending&department_id=<my dept>` |
| Approve/reject + comment | — | `POST /reimbursement-requests/{id}/decision` |
| Approved archive | — | `GET /reimbursement-requests/approved` |
| Department dashboard | — | `GET /reimbursement-requests/summary` |
| FX rates viewer | `GET /fx-rates` | `GET /fx-rates` |
| FX rates admin | — | `PUT /fx-rates/{currency}` |
| Audit/history of an item | `GET .../audit` (own) | `GET .../audit` (own dept) |
| Receipt download | own | own dept |

Managers are **scoped to their own department** everywhere: cross-department
requests return 403, foreign-object lookups return 404. Use
`GET /users/me` → `department_id` to pre-fill filters; let the server be the
source of truth (never show cross-department data "leaked" via 404s).

---

## 9. Suggested client structure

```
src/
├── api/
│   ├── client.ts        # fetch wrapper: base URL, Bearer injection, 401 interceptor
│   ├── types.ts         # generated from /openapi.json (or hand-written per §3, §6)
│   ├── auth.ts  expenses.ts  requests.ts  fx.ts   # one module per resource
│   └── errors.ts        # unwrap {detail:{code,message}} → typed error
├── store/
│   ├── session.ts       # token + /users/me (role, department) — gate routing
│   └── expenses.ts requests.ts   # pagination-aware lists, refetch on 409
├── components/  pages/  (screens per §8)
```

Practical tips:
- Generate types from `/openapi.json` — every schema here is Pydantic v2
  output, so the spec is exact.
- Keep a tiny decimal helper: `parseMoney(str) → Decimal` for sums; never
  `parseFloat` money.
- On **409/404**, refetch the item before showing an error — the UI nearly
  always goes stale (someone else decided/edited first).
- Receipts upload: `FormData` with key `file`; show progress; on 422
  "file content does not match its .pdf extension" tell the user the file is
  wrong (not just "upload failed").
- `q` search on expenses is substring on description/vendor — debounce 300ms.

---

## 10. End-to-end smoke checklist

- [ ] Login → token → `GET /users/me` shows correct role/department.
- [ ] Create 2 expenses (USD + EUR), attach a PDF receipt to one.
- [ ] Edit + delete a draft expense; verify edit on a submitted expense 409s.
- [ ] Submit `period=2025-06` → both expenses now `submitted` with
      `base_amount` populated; duplicate submit shows the pending-existing 409.
- [ ] Manager sees the request in the pending queue, approves with a comment.
- [ ] Request status `approved`; appears in `/approved` and in `/summary`
      totals (EUR line shows original `120.00` and base `~126.32`).
- [ ] Reject flow: second request, then reject → expenses back to `draft`
      (editable), request detail still shows the original `expense_snapshot`.
- [ ] Receipt download opens the same file with correct `Content-Type`.
- [ ] Audit endpoint returns events for everything done above, newest first.
- [ ] Expired/invalid token → 401 → app routes back to login.
