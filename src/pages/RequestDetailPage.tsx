import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  Check,
  FileArrowDown,
  PaperPlaneTilt,
  Paperclip,
  User,
  X,
} from "@phosphor-icons/react";
import { decideRequest, downloadReceipt, getRequest, submitRequest } from "../api/endpoints";
import type { ReimbursementRequestOut } from "../api/types";
import { ApiError } from "../api/client";
import { formatDate, formatDateTime, formatPeriod } from "../lib/date";
import { formatMoney, sumMoney } from "../lib/money";
import { useSession } from "../store/session";
import { AmountWithBase, Money } from "../components/Money";
import { RequestStatusBadge } from "../components/StatusBadge";
import { AuditPanel } from "../components/AuditPanel";
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  PageSkeleton,
  Textarea,
} from "../components/ui";

export default function RequestDetailPage() {
  const { id } = useParams();
  const requestId = Number(id);
  const navigate = useNavigate();
  const { user } = useSession();

  const [req, setReq] = useState<ReimbursementRequestOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [comment, setComment] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);

  const load = useCallback(() => {
    if (Number.isNaN(requestId)) {
      setNotFound(true);
      return;
    }
    setError(null);
    setNotFound(false);
    getRequest(requestId).then(setReq).catch((err: unknown) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        setNotFound(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Could not load this request.");
      }
    });
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (action: "approve" | "reject") => {
    setDeciding(true);
    setDecideError(null);
    try {
      await decideRequest(requestId, action, comment.trim() || undefined);
      setComment("");
      load();
    } catch (err) {
      setDecideError(
        err instanceof ApiError
          ? err.message
          : "Could not record the decision. Please try again.",
      );
      if (err instanceof ApiError && err.code === "conflict") load();
    } finally {
      setDeciding(false);
    }
  };

  const resubmit = async () => {
    if (!req) return;
    setResubmitting(true);
    setDecideError(null);
    try {
      const next = await submitRequest(req.period);
      navigate(`/requests/${next.id}`, { replace: true });
    } catch (err) {
      setDecideError(err instanceof ApiError ? err.message : "Could not submit again.");
      setResubmitting(false);
    }
  };

  const isManager = user?.role === "manager";
  const canDecide = isManager && req?.status === "pending";

  // Rows merge the immutable snapshot (description/vendor) with the current
  // expense list (base amounts + dates) by id.
  const rows = useMemo(() => {
    if (!req) return [];
    const byId = new Map(req.expenses.map((e) => [e.id, e]));
    return (req.expense_snapshot ?? []).map((s) => {
      const cur = byId.get(s.id);
      return {
        id: s.id,
        category: s.category,
        description: s.description,
        vendor: s.vendor,
        amount: s.amount,
        currency: s.currency,
        base_amount: cur?.base_amount ?? null,
        occurred_at: cur?.occurred_at ?? null,
        // Prefer the receipts snapshotted at submission time; fall back to
        // the live expense's list (older requests whose snapshot predates
        // receipt metadata).
        receipts: s.receipts ?? cur?.receipts ?? [],
      };
    });
  }, [req]);

  const totals = useMemo(() => {
    if (!req) return [];
    const map = new Map<string, string[]>();
    rows.forEach((r) => {
      const arr = map.get(r.currency) ?? [];
      arr.push(r.amount);
      map.set(r.currency, arr);
    });
    return [...map.entries()].map(([currency, amounts]) => ({ currency, total: sumMoney(amounts) }));
  }, [rows, req]);

  const expenseIds = useMemo(() => (req ? req.expenses.map((e) => e.id) : []), [req]);

  const baseUsd = useMemo(() => {
    if (!req) return null;
    const bases = rows.map((r) => r.base_amount);
    if (bases.length === 0 || bases.some((b) => b === null)) return null;
    return sumMoney(bases as string[]);
  }, [rows, req]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-line bg-panel">
        <EmptyState
          icon={<PaperPlaneTilt size={20} />}
          title="Request not found"
          body="It may not exist, or you may not have access to it."
          action={
            <Button onClick={() => navigate(-1)} icon={<ArrowLeft size={14} />}>
              Go back
            </Button>
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md">
        <ErrorBanner message={error} onRetry={load} />
      </div>
    );
  }

  if (!req) {
    return <PageSkeleton rows={6} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => navigate(-1)}
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Request · {formatPeriod(req.period)}
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-3">
            Submitted {formatDateTime(req.submitted_at)}
            {req.decided_at ? ` · decided ${formatDateTime(req.decided_at)}` : ""}
          </p>
        </div>
        <RequestStatusBadge status={req.status} />
      </div>

      {/* Who filed this request — managers see this before deciding. */}
      <div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <User size={16} weight="fill" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{req.employee.full_name}</p>
          <p className="truncate text-xs text-ink-3">
            {req.employee.email}
            {req.employee.department_name ? ` · ${req.employee.department_name}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-ink-3">Filed by</span>
      </div>

      {decideError && <ErrorBanner message={decideError} />}

      {req.status === "rejected" && (
        <div className="rounded-[10px] border border-bad/25 bg-bad-soft px-4 py-3.5">
          <p className="text-sm font-medium text-bad">
            Rejected{req.decision_comment ? `: ${req.decision_comment}` : "."}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            The expenses in this request were returned to drafts. Edit them and submit again for
            this month.
          </p>
          {user?.role === "employee" && (
            <Button
              className="mt-3"
              onClick={resubmit}
              loading={resubmitting}
              icon={<ArrowCounterClockwise size={14} />}
            >
              Submit {formatPeriod(req.period)} again
            </Button>
          )}
        </div>
      )}

      {canDecide && (
        <div className="rounded-xl border border-line bg-panel p-4">
          <Field
            label="Decision comment"
            htmlFor="decision-comment"
            hint="Optional. Shown to the employee and kept in the audit history."
          >
            <Textarea
              id="decision-comment"
              placeholder="e.g. Looks good to me"
              value={comment}
              maxLength={1000}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => decide("reject")}
              loading={deciding}
              icon={<X size={14} />}
              className="!text-bad hover:!bg-bad-soft"
            >
              Reject
            </Button>
            <Button variant="primary" onClick={() => decide("approve")} loading={deciding} icon={<Check size={14} weight="bold" />}>
              Approve
            </Button>
          </div>
        </div>
      )}

      {/* Expenses snapshot */}
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Expenses in this request</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            {rows.length} {rows.length === 1 ? "expense" : "expenses"} · snapshot taken at submission
          </p>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{r.description}</p>
                <p className="truncate text-xs text-ink-3">
                  {r.category}
                  {r.vendor ? ` · ${r.vendor}` : ""}
                  {r.occurred_at ? ` · ${formatDate(r.occurred_at)}` : ""}
                </p>
                {r.receipts.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {r.receipts.map((rc) => (
                      <button
                        key={rc.id}
                        type="button"
                        onClick={() => downloadReceipt(r.id, rc.id, rc.filename)}
                        title={`Download ${rc.filename}`}
                        className="inline-flex max-w-full items-center gap-1 rounded-[8px] border border-line bg-panel-2/60 px-1.5 py-0.5 text-[11px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                      >
                        <Paperclip size={11} className="shrink-0" aria-hidden />
                        <span className="truncate">{rc.filename}</span>
                        <FileArrowDown size={11} className="shrink-0" aria-hidden />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0">
                {r.currency === "USD" || !r.base_amount ? (
                  <Money amount={r.amount} currency={r.currency} className="text-sm" />
                ) : (
                  <AmountWithBase amount={r.amount} currency={r.currency} baseAmount={r.base_amount} className="text-sm" />
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-line bg-panel-2/50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-ink-2">Totals</span>
            <div className="flex flex-col items-end gap-0.5">
              {totals.map((t) => (
                <span key={t.currency} className="font-mono tnum text-[13px] text-ink-2">
                  {t.currency} {formatMoney(t.total, t.currency)}
                </span>
              ))}
              {baseUsd && (
                <span className="font-mono tnum text-[13px] text-ink">
                  ≈ {formatMoney(baseUsd, "USD")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <AuditPanel kind="request" id={req.id} expenseIds={expenseIds} />
    </div>
  );
}