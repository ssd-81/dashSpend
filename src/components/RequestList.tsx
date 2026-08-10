import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CaretRight, Check, PaperPlaneTilt, X } from "@phosphor-icons/react";
import type { Page, ReimbursementRequestOut } from "../api/types";
import { ApiError } from "../api/client";
import { decideRequest } from "../api/endpoints";
import { formatDateTime } from "../lib/date";
import { formatMoney, sumMoney } from "../lib/money";
import { RequestStatusBadge } from "./StatusBadge";
import { EmptyState, ErrorBanner, PageSkeleton, Button } from "./ui";

function requestTotal(req: ReimbursementRequestOut): string | null {
  const bases = req.expenses.map((e) => e.base_amount);
  if (bases.length === 0 || bases.some((b) => b === null)) return null;
  return sumMoney(bases as string[]);
}

export default function RequestList({
  loader,
  emptyTitle,
  emptyBody,
  showActions = false,
}: {
  loader: (page: number) => Promise<Page<ReimbursementRequestOut>>;
  emptyTitle: string;
  emptyBody?: string;
  /** Render inline Approve/Reject actions on pending rows (review queue). */
  showActions?: boolean;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ReimbursementRequestOut[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loader(1)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        setPage(res.page);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load requests.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loader]);

  const decide = useCallback(
    async (req: ReimbursementRequestOut, action: "approve" | "reject") => {
      setDecidingId(req.id);
      setError(null);
      try {
        await decideRequest(req.id, action);
        setItems((prev) => prev.filter((r) => r.id !== req.id));
        setTotal((t) => Math.max(0, t - 1));
      } catch (err) {
        if (err instanceof ApiError && err.code === "conflict") {
          // Already decided elsewhere — it is no longer pending, so drop it.
          setItems((prev) => prev.filter((r) => r.id !== req.id));
          setTotal((t) => Math.max(0, t - 1));
        } else {
          setError(err instanceof ApiError ? err.message : "Could not record the decision.");
        }
      } finally {
        setDecidingId(null);
      }
    },
    [],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      {error && (
        <div className="p-4">
          <ErrorBanner message={error} onRetry={() => window.location.reload()} />
        </div>
      )}
      {!error && loading && <PageSkeleton rows={5} />}
      {!error && !loading && items.length === 0 && (
        <EmptyState icon={<PaperPlaneTilt size={20} />} title={emptyTitle} body={emptyBody} />
      )}
      {items.length > 0 && (
        <ul className="divide-y divide-line">
          {items.map((req) => {
            const totalUsd = requestTotal(req);
            const n = req.expenses.length;
            const decidingThis = decidingId === req.id;
            return (
              <li key={req.id}>
                <div className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-hover">
                  <button
                    onClick={() => navigate(`/requests/${req.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono tnum text-sm font-semibold text-ink">{req.period}</span>
                        <RequestStatusBadge status={req.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-ink-3">
                        {n} {n === 1 ? "expense" : "expenses"} · submitted {formatDateTime(req.submitted_at)}
                      </p>
                      {req.status === "rejected" && req.decision_comment && (
                        <p className="mt-1 line-clamp-2 text-xs text-bad">Rejected: {req.decision_comment}</p>
                      )}
                    </div>
                    {totalUsd && (
                      <span className="shrink-0 font-mono tnum text-sm text-ink">
                        ≈ {formatMoney(totalUsd, "USD")}
                      </span>
                    )}
                    <CaretRight size={14} className="shrink-0 text-ink-3" aria-hidden />
                  </button>
                  {showActions && req.status === "pending" && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="secondary"
                        className="!text-bad hover:!bg-bad-soft"
                        icon={<X size={13} />}
                        loading={decidingThis}
                        disabled={decidingId !== null}
                        onClick={() => decide(req, "reject")}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        icon={<Check size={13} weight="bold" />}
                        loading={decidingThis}
                        disabled={decidingId !== null}
                        onClick={() => decide(req, "approve")}
                      >
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 0 && items.length < total && (
        <div className="border-t border-line px-4 py-3">
          <Button
            className="w-full"
            loading={loadingMore}
            disabled={loadingMore}
            onClick={() => {
              setLoadingMore(true);
              loader(page + 1)
                .then((res) => {
                  setItems((prev) => [...prev, ...res.items]);
                  setPage(res.page);
                  setError(null);
                })
                .catch((err) => {
                  setError(err instanceof ApiError ? err.message : "Could not load more requests.");
                })
                .finally(() => setLoadingMore(false));
            }}
          >
            Load more ({total - items.length} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
