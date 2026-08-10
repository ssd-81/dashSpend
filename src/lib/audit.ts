// Audit action -> human label. Unknown actions fall back to a prettified
// version of the raw value.

const LABELS: Record<string, string> = {
  "expense.created": "Expense created",
  "expense.updated": "Expense updated",
  "expense.deleted": "Expense deleted",
  "receipt.attached": "Receipt attached",
  "receipt.deleted": "Receipt removed",
  "expense.submitted": "Submitted for reimbursement",
  "expense.reverted_to_draft": "Reverted to draft",
  "request.submitted": "Request submitted",
  "request.approve": "Approved",
  "request.reject": "Rejected",
  "fx_rate.created": "FX rate created",
  "fx_rate.updated": "FX rate updated",
};

export function auditLabel(action: string): string {
  if (LABELS[action]) return LABELS[action];
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
