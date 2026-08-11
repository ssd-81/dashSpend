// Wire types mirrored from the backend OpenAPI spec / base.md.

export type Role = "employee" | "manager";
export type ExpenseStatus = "draft" | "submitted";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserOut {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  department_id: number | null;
  department_name: string | null;
}

export interface DepartmentOut {
  id: number;
  name: string;
}

export interface RegisterIn {
  email: string;
  password: string;
  full_name: string;
  department_id: number;
  role: Role;
}

export interface ReceiptOut {
  id: number;
  filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  uploaded_at: string;
}

export interface ExpenseOut {
  id: number;
  category: string;
  amount: string;
  currency: string;
  occurred_at: string;
  description: string;
  vendor: string | null;
  status: ExpenseStatus;
  request_id: number | null;
  fx_rate_to_base: string | null;
  base_amount: string | null;
  converted_at: string | null;
  created_at: string;
  receipts: ReceiptOut[];
}

export interface ExpenseCreate {
  category: string;
  amount: string;
  currency: string;
  occurred_at: string;
  description: string;
  vendor: string | null;
}

export interface ExpenseBrief {
  id: number;
  category: string;
  amount: string;
  currency: string;
  description: string;
  vendor: string | null;
  // Receipt metadata snapshotted at submission time (may be absent on very
  // old requests whose snapshots predate this field).
  receipts?: ReceiptBrief[];
}

export interface ReceiptBrief {
  id: number;
  filename: string;
  size_bytes: number;
}

export interface RequestExpense {
  id: number;
  category: string;
  amount: string;
  currency: string;
  base_amount: string | null;
  occurred_at: string;
  receipts: ReceiptBrief[];
}

/** Nested employee summary embedded in every reimbursement request payload. */
export interface EmployeeOut {
  id: number;
  email: string;
  full_name: string;
  department_id: number;
  department_name: string | null;
}

export interface ReimbursementRequestOut {
  id: number;
  employee_id: number;
  /**
   * Who filed the request (manager views show this to identify the submitter).
   * The backend embeds it on every request payload, but it is kept optional so
   * an older backend without the field cannot crash rendering.
   */
  employee?: EmployeeOut;
  period: string;
  status: RequestStatus;
  submitted_at: string;
  decided_at: string | null;
  decision_comment: string | null;
  decided_by: number | null;
  expense_snapshot: ExpenseBrief[] | null;
  expenses: RequestExpense[];
}

export interface SummaryOut {
  period: string | null;
  department_id: number | null;
  total_requests: number;
  counts_by_status: { pending: number; approved: number; rejected: number };
  total_approved_base_amount: string | null;
  approved_by_category: { category: string; total: string }[];
  approved_base_by_currency: { currency: string; total: string }[];
  approved_original_by_currency: { currency: string; total: string }[];
}

export interface FxRateOut {
  id: number;
  currency: string;
  base_currency: string;
  rate: string;
  effective_date: string;
}

export interface AuditEventOut {
  id: number;
  occurred_at: string;
  actor_id: number;
  actor_role: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  comment: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  errors?: { type: string; loc: string[]; msg: string }[];
}
