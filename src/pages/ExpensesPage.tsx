import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AirplaneTilt,
  Bed,
  Briefcase,
  Car,
  FolderPlus,
  ForkKnife,
  MagnifyingGlass,
  Monitor,
  PaperPlaneTilt,
  Plus,
  Tag,
  Ticket,
  Trash,
  X,
} from "@phosphor-icons/react";
import { listExpenses, listRequests, submitRequest } from "../api/endpoints";
import type { ExpenseOut } from "../api/types";
import { ApiError } from "../api/client";
import { CATEGORIES, CURRENCIES } from "../lib/constants";
import { currentPeriod, formatDate, formatPeriod } from "../lib/date";
import { sumMoney } from "../lib/money";
import { useSession } from "../store/session";
import { Money } from "../components/Money";
import { ExpenseStatusBadge } from "../components/StatusBadge";
import ExpenseModal from "../components/ExpenseModal";
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Modal,
  PageSkeleton,
  Select,
} from "../components/ui";

function CategoryIcon({ category, size = 17 }: { category: string; size?: number }) {
  const icons: Record<string, React.ReactNode> = {
    Travel: <AirplaneTilt size={size} />,
    Meals: <ForkKnife size={size} />,
    Lodging: <Bed size={size} />,
    "Office Supplies": <Briefcase size={size} />,
    Software: <Monitor size={size} />,
    Transport: <Car size={size} />,
    Entertainment: <Ticket size={size} />,
    Other: <Tag size={size} />,
  };
  return <>{icons[category] ?? <Tag size={size} />}</>;
}

const EMPTY_FILTERS = { q: "", category: "", status: "", currency: "", period: "" };
type Filters = typeof EMPTY_FILTERS;

export default function ExpensesPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const isEmployee = user?.role === "employee";

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [items, setItems] = useState<ExpenseOut[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalId, setModalId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  // A pending request for the current month blocks new submissions for it.
  const [pendingThisMonth, setPendingThisMonth] = useState(0);

  useEffect(() => {
    if (!isEmployee) return;
    let cancelled = false;
    listRequests({ status: "pending", period: currentPeriod(), page_size: 1 })
      .then((r) => {
        if (!cancelled) setPendingThisMonth(r.total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isEmployee]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  // Debounced fetch. q is a substring search on description/vendor.
  const debouncedQ = useDebounced(filters.q, 300);

  const fetchPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await listExpenses({
          page: pageNum,
          page_size: 25,
          q: debouncedQ || undefined,
          category: filters.category || undefined,
          status: filters.status || undefined,
          currency: filters.currency || undefined,
          period: filters.period || undefined,
        });
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(res.page);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load expenses.");
      } finally {
        setLoading(false);
      }
    },
    [debouncedQ, filters.category, filters.status, filters.currency, filters.period],
  );

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  // After a mutation (create/edit/delete/submit) always reload from page 1
  // with replace, otherwise the list would append duplicates of itself.
  const refresh = useCallback(() => fetchPage(1, true), [fetchPage]);

  const setFilter = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Expenses</h1>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {loading ? "Loading..." : `${total} ${total === 1 ? "expense" : "expenses"}`}
            {hasActiveFilters && !loading ? " match your filters" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEmployee && (
            <Button
              onClick={() => setSubmitOpen(true)}
              icon={<PaperPlaneTilt size={15} />}
              disabled={pendingThisMonth > 0}
              title={
                pendingThisMonth > 0
                  ? `A request for ${formatPeriod(currentPeriod())} is already pending review.`
                  : `Submit ${formatPeriod(currentPeriod())}`
              }
              className={pendingThisMonth > 0 ? "opacity-60" : ""}
            >
              Submit {formatPeriod(currentPeriod())}
            </Button>
          )}
          <Button variant="primary" onClick={() => setCreating(true)} icon={<Plus size={15} weight="bold" />}>
            New expense
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <Input
            aria-label="Search expenses"
            placeholder="Search description or vendor"
            value={filters.q}
            onChange={(e) => setFilter("q", e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Category"
            value={filters.category}
            onChange={(e) => setFilter("category", e.target.value)}
            className="w-auto min-w-32"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Status"
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className="w-auto min-w-28"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
          </Select>
          <Select
            aria-label="Currency"
            value={filters.currency}
            onChange={(e) => setFilter("currency", e.target.value)}
            className="w-auto min-w-24"
          >
            <option value="">All currencies</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Period"
            type="month"
            value={filters.period}
            onChange={(e) => setFilter("period", e.target.value)}
            className="w-40"
          />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              icon={<X size={14} />}
              className="h-9 px-2.5"
              aria-label="Clear filters"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {error && (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={() => fetchPage(1, true)} />
          </div>
        )}

        {!error && loading && items.length === 0 && <PageSkeleton rows={6} />}

        {!error && !loading && items.length === 0 && (
          <EmptyState
            icon={<FolderPlus size={20} />}
            title={hasActiveFilters ? "No matching expenses" : "No expenses yet"}
            body={
              hasActiveFilters
                ? "Nothing matches these filters. Try widening your search."
                : "Record your first expense and submit it for reimbursement at the end of the month."
            }
            action={
              hasActiveFilters ? (
                <Button onClick={clearFilters}>Clear filters</Button>
              ) : (
                <Button variant="primary" onClick={() => setCreating(true)} icon={<Plus size={15} weight="bold" />}>
                  New expense
                </Button>
              )
            }
          />
        )}

        {items.length > 0 && (
          <ul className="divide-y divide-line">
            {items.map((exp) => {
              const draft = exp.status === "draft";
              return (
                <li key={exp.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-hover">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-panel-2 text-ink-2">
                    <CategoryIcon category={exp.category} />
                  </div>
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setModalId(exp.id)}
                    aria-label={`View ${exp.description}`}
                  >
                    <p className="truncate text-sm font-medium text-ink">{exp.description}</p>
                    <p className="truncate text-xs text-ink-3">
                      {[exp.vendor, formatDate(exp.occurred_at)].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-3">
                    <Money amount={exp.amount} currency={exp.currency} className="text-sm" muted={draft} />
                    <ExpenseStatusBadge status={exp.status} />
                    {draft && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => setModalId(exp.id)}
                          className="rounded-[8px] px-2 py-1 text-[11px] font-medium text-ink-3 transition-colors hover:bg-hover hover:text-ink"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setModalId(exp.id)}
                          aria-label={`Delete ${exp.description}`}
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad"
                        >
                          <Trash size={15} />
                        </button>
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
            <Button onClick={() => fetchPage(page + 1, false)} loading={loading} className="w-full">
              Load more ({total - items.length} remaining)
            </Button>
          </div>
        )}
      </div>

      {/* Edit / detail / create modal */}
      <ExpenseModal
        open={creating || modalId !== null}
        expenseId={modalId}
        onClose={() => {
          setCreating(false);
          setModalId(null);
        }}
        onChanged={refresh}
      />

      <SubmitModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        defaultPeriod={currentPeriod()}
        onSubmitted={(reqId) => navigate(`/requests/${reqId}`)}
        onChanged={refresh}
      />
    </div>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function SubmitModal({
  open,
  onClose,
  defaultPeriod,
  onSubmitted,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  defaultPeriod: string;
  onSubmitted: (requestId: number) => void;
  onChanged: () => void;
}) {
  const [period, setPeriod] = useState(defaultPeriod);
  const [drafts, setDrafts] = useState<ExpenseOut[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  // Reload the draft preview whenever the modal or period changes.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setConflict(false);
    setDrafts(null);
    let cancelled = false;
    listExpenses({ period, status: "draft", page_size: 100 })
      .then((res) => {
        if (!cancelled) setDrafts(res.items);
      })
      .catch(() => {
        if (!cancelled) setDrafts([]);
      });
    // A pending request for this period blocks submission.
    listRequests({ status: "pending", period, page_size: 1 })
      .then((r) => {
        if (!cancelled) setConflict(r.total > 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, period]);

  const totals = useMemo(() => {
    const map = new Map<string, string[]>();
    (drafts ?? []).forEach((d) => {
      const arr = map.get(d.currency) ?? [];
      arr.push(d.amount);
      map.set(d.currency, arr);
    });
    return [...map.entries()].map(([currency, amounts]) => ({
      currency,
      total: sumMoney(amounts),
      count: amounts.length,
    }));
  }, [drafts]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const req = await submitRequest(period);
      onChanged();
      onSubmitted(req.id);
      onClose();
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.code === "conflict") setConflict(true);
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  const canSubmit = !busy && !conflict && (drafts?.length ?? 0) > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit for reimbursement"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!canSubmit} icon={<PaperPlaneTilt size={15} />}>
            Submit {formatPeriod(period)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        {conflict && (
          <p className="rounded-[10px] border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-warn">
            A request for {formatPeriod(period)} is already pending review. You can submit again
            after it is decided.
          </p>
        )}
        <Field
          label="Period"
          htmlFor="submit-period"
          hint="All your draft expenses in this month are included."
        >
          <Input
            id="submit-period"
            type="month"
            value={period}
            max={currentPeriod()}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </Field>

        <div className="rounded-[10px] border border-line bg-panel-2/50 p-3.5">
          {drafts === null ? (
            <p className="text-sm text-ink-3">Checking draft expenses...</p>
          ) : drafts.length === 0 ? (
            <p className="text-sm text-ink-3">
              No draft expenses in {formatPeriod(period)}. Nothing to submit.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-ink">
                {drafts.length} draft {drafts.length === 1 ? "expense" : "expenses"} in{" "}
                {formatPeriod(period)}
              </p>
              <ul className="mt-2 space-y-1">
                {drafts.slice(0, 6).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate text-ink-2">{d.description}</span>
                    <Money amount={d.amount} currency={d.currency} className="text-[13px]" muted />
                  </li>
                ))}
                {drafts.length > 6 && (
                  <li className="text-xs text-ink-3">and {drafts.length - 6} more</li>
                )}
              </ul>
              <div className="mt-2 border-t border-line pt-2">
                {totals.map((t) => (
                  <div key={t.currency} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-3">{t.count} × {t.currency}</span>
                    <Money amount={t.total} currency={t.currency} muted />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}