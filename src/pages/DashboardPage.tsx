import { useCallback, useEffect, useState } from "react";
import { SquaresFour } from "@phosphor-icons/react";
import { fetchSummary } from "../api/endpoints";
import type { SummaryOut } from "../api/types";
import { ApiError } from "../api/client";
import { currentPeriod, formatPeriod } from "../lib/date";
import { formatMoney } from "../lib/money";
import { useSession } from "../store/session";
import { EmptyState, ErrorBanner, Input, PageSkeleton } from "../components/ui";

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "text-warn" },
  approved: { label: "Approved", tone: "text-ok" },
  rejected: { label: "Rejected", tone: "text-bad" },
};

export default function DashboardPage() {
  const { user } = useSession();
  const [period, setPeriod] = useState(currentPeriod());
  const [data, setData] = useState<SummaryOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSummary({ period: period || undefined, department_id: user?.department_id ?? undefined })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load the summary.");
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, user?.department_id]);

  const maxCategory = useCallback(
    () => Math.max(1, ...(data?.approved_by_category ?? []).map((c) => Number(c.total))),
    [data],
  );
  const maxCurrency = useCallback(
    () => Math.max(1, ...(data?.approved_base_by_currency ?? []).map((c) => Number(c.total))),
    [data],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Department overview</h1>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {user?.department_name ?? "Your department"} · {formatPeriod(period)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="dash-period" className="text-[13px] font-medium text-ink-2">
            Period
          </label>
          <Input
            id="dash-period"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => window.location.reload()} />}

      {loading && <PageSkeleton rows={5} />}

      {!loading && !error && data && (
        <>
          {/* Stat blocks */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-line bg-panel px-4 py-4">
              <p className="text-xs font-medium text-ink-3">Total approved</p>
              <p className="mt-1.5 font-mono tnum text-2xl font-semibold tracking-tight text-ink">
                {data.total_approved_base_amount
                  ? formatMoney(data.total_approved_base_amount, "USD")
                  : "—"}
              </p>
              <p className="mt-1 text-[11px] text-ink-3">in base USD</p>
            </div>
            {(["pending", "approved", "rejected"] as const).map((s) => (
              <div key={s} className="rounded-xl border border-line bg-panel px-4 py-4">
                <p className="text-xs font-medium text-ink-3">{STATUS_LABELS[s].label}</p>
                <p className={`mt-1.5 font-mono tnum text-2xl font-semibold tracking-tight ${STATUS_LABELS[s].tone}`}>
                  {data.counts_by_status[s] ?? 0}
                </p>
                <p className="mt-1 text-[11px] text-ink-3">
                  {s === "pending" ? "awaiting review" : s === "approved" ? "paid out" : "returned to drafts"}
                </p>
              </div>
            ))}
          </div>

          {data.total_requests === 0 ? (
            <div className="rounded-xl border border-line bg-panel">
              <EmptyState
                icon={<SquaresFour size={20} />}
                title="Nothing here yet"
                body={`No reimbursement requests were submitted in ${formatPeriod(period)}.`}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {/* By category */}
              <div className="rounded-xl border border-line bg-panel p-4">
                <h2 className="text-sm font-semibold text-ink">Approved by category</h2>
                {data.approved_by_category.length === 0 ? (
                  <p className="mt-3 text-[13px] text-ink-3">No approved expenses this period.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {data.approved_by_category.map((c) => (
                      <li key={c.category}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[13px] font-medium text-ink-2">{c.category}</span>
                          <span className="font-mono tnum text-[13px] text-ink">
                            {formatMoney(c.total, "USD")}
                          </span>
                        </div>
                        {/* Thin inline bar with no background track. */}
                        <div
                          className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-transparent"
                          aria-hidden
                        >
                          <div
                            className="h-full rounded-full bg-accent/70 transition-[width] duration-300"
                            style={{ width: `${(Number(c.total) / maxCategory()) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* By currency */}
              <div className="rounded-xl border border-line bg-panel p-4">
                <h2 className="text-sm font-semibold text-ink">Approved by currency</h2>
                {data.approved_base_by_currency.length === 0 ? (
                  <p className="mt-3 text-[13px] text-ink-3">No approved expenses this period.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {data.approved_base_by_currency.map((c) => {
                      const original = data.approved_original_by_currency.find(
                        (o) => o.currency === c.currency,
                      );
                      return (
                        <li key={c.currency}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[13px] font-medium text-ink-2">{c.currency}</span>
                            <span className="font-mono tnum text-[13px] text-ink">
                              {original ? formatMoney(original.total, c.currency) + " → " : ""}
                              {formatMoney(c.total, "USD")}
                            </span>
                          </div>
                          <div
                            className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-transparent"
                            aria-hidden
                          >
                            <div
                              className="h-full rounded-full bg-accent/70 transition-[width] duration-300"
                              style={{ width: `${(Number(c.total) / maxCurrency()) * 100}%` }}
                            />
                          </div>
                          {original && original.currency !== "USD" && (
                            <p className="mt-0.5 text-[11px] text-ink-3">
                              {formatMoney(original.total, original.currency)} in original currency
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}