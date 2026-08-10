import { Badge, type BadgeTone } from "./ui";
import type { ExpenseStatus, RequestStatus } from "../api/types";

const EXPENSE_STATUS: Record<ExpenseStatus, { tone: BadgeTone; label: string }> = {
  draft: { tone: "mute", label: "Draft" },
  submitted: { tone: "accent", label: "Submitted" },
};

const REQUEST_STATUS: Record<RequestStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: "warn", label: "Pending" },
  approved: { tone: "ok", label: "Approved" },
  rejected: { tone: "bad", label: "Rejected" },
};

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const s = EXPENSE_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const s = REQUEST_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
