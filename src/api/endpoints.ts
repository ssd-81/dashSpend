// One typed function per backend endpoint. Grouped by resource.
import { qs, request } from "./client";
import type {
  AuditEventOut,
  DepartmentOut,
  ExpenseCreate,
  ExpenseOut,
  FxRateOut,
  Page,
  ReceiptOut,
  RegisterIn,
  ReimbursementRequestOut,
  SummaryOut,
  TokenResponse,
  UserOut,
} from "./types";

// ---- Auth & profile -------------------------------------------------------

export function login(username: string, password: string): Promise<TokenResponse> {
  const form = new URLSearchParams({ username, password });
  return request<TokenResponse>("/auth/token", { method: "POST", form, auth: false });
}

export function register(body: RegisterIn): Promise<UserOut> {
  return request<UserOut>("/auth/register", { method: "POST", json: body, auth: false });
}

export function listDepartments(): Promise<DepartmentOut[]> {
  return request<DepartmentOut[]>("/departments", { auth: false });
}

export function fetchMe(): Promise<UserOut> {
  return request<UserOut>("/users/me");
}

// ---- Expenses --------------------------------------------------------------

export interface ExpenseFilters {
  page?: number;
  page_size?: number;
  period?: string;
  from_date?: string;
  to_date?: string;
  category?: string;
  status?: string;
  currency?: string;
  min_amount?: string;
  max_amount?: string;
  q?: string;
}

export function listExpenses(f: ExpenseFilters = {}): Promise<Page<ExpenseOut>> {
  return request<Page<ExpenseOut>>(`/expenses${qs({ ...f })}`);
}

export function getExpense(id: number): Promise<ExpenseOut> {
  return request<ExpenseOut>(`/expenses/${id}`);
}

export function createExpense(body: ExpenseCreate): Promise<ExpenseOut> {
  return request<ExpenseOut>("/expenses", { method: "POST", json: body });
}

export function updateExpense(id: number, patch: Partial<ExpenseCreate>): Promise<ExpenseOut> {
  return request<ExpenseOut>(`/expenses/${id}`, { method: "PATCH", json: patch });
}

export function deleteExpense(id: number): Promise<void> {
  return request<void>(`/expenses/${id}`, { method: "DELETE" });
}

// ---- Receipts --------------------------------------------------------------

export function uploadReceipt(expenseId: number, file: File): Promise<ReceiptOut> {
  const fd = new FormData();
  fd.append("file", file);
  return request<ReceiptOut>(`/expenses/${expenseId}/receipts`, {
    method: "POST",
    formData: fd,
  });
}

export async function downloadReceipt(expenseId: number, receiptId: number, filename: string) {
  const blob = await request<Blob>(`/expenses/${expenseId}/receipts/${receiptId}`, { blob: true });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function deleteReceipt(expenseId: number, receiptId: number): Promise<void> {
  return request<void>(`/expenses/${expenseId}/receipts/${receiptId}`, { method: "DELETE" });
}

// ---- Audit -----------------------------------------------------------------

export function getExpenseAudit(id: number): Promise<AuditEventOut[]> {
  return request<AuditEventOut[]>(`/expenses/${id}/audit`);
}

export function getRequestAudit(id: number): Promise<AuditEventOut[]> {
  return request<AuditEventOut[]>(`/reimbursement-requests/${id}/audit`);
}

// ---- Reimbursement requests ------------------------------------------------

export function submitRequest(period: string, expenseIds?: number[]): Promise<ReimbursementRequestOut> {
  return request<ReimbursementRequestOut>("/reimbursement-requests", {
    method: "POST",
    json: { period, expense_ids: expenseIds ?? null },
  });
}

export interface RequestFilters {
  page?: number;
  page_size?: number;
  period?: string;
  status?: string;
  employee_id?: number;
  department_id?: number;
}

export function listRequests(f: RequestFilters = {}): Promise<Page<ReimbursementRequestOut>> {
  return request<Page<ReimbursementRequestOut>>(`/reimbursement-requests${qs({ ...f })}`);
}

export function listApproved(f: RequestFilters = {}): Promise<Page<ReimbursementRequestOut>> {
  return request<Page<ReimbursementRequestOut>>(`/reimbursement-requests/approved${qs({ ...f })}`);
}

export function getRequest(id: number): Promise<ReimbursementRequestOut> {
  return request<ReimbursementRequestOut>(`/reimbursement-requests/${id}`);
}

export function decideRequest(
  id: number,
  action: "approve" | "reject",
  comment?: string,
): Promise<ReimbursementRequestOut> {
  return request<ReimbursementRequestOut>(`/reimbursement-requests/${id}/decision`, {
    method: "POST",
    json: { action, comment: comment || null },
  });
}

export function fetchSummary(f: { period?: string; department_id?: number } = {}): Promise<SummaryOut> {
  return request<SummaryOut>(`/reimbursement-requests/summary${qs(f)}`);
}

// ---- FX rates --------------------------------------------------------------

export function listFxRates(f: { currency?: string; as_of?: string } = {}): Promise<FxRateOut[]> {
  return request<FxRateOut[]>(`/fx-rates${qs(f)}`);
}

export function upsertFxRate(currency: string, body: { rate: string; effective_date: string }): Promise<FxRateOut> {
  return request<FxRateOut>(`/fx-rates/${currency}`, { method: "PUT", json: body });
}
