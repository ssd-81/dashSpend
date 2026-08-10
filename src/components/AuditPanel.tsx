import { useEffect, useState } from "react";
import { ClockCounterClockwise, DotsThree, FileArrowDown, Trash } from "@phosphor-icons/react";
import { auditLabel } from "../lib/audit";
import { formatDateTime, humanSize } from "../lib/date";
import { getRequestAudit, getExpenseAudit } from "../api/endpoints";
import type { AuditEventOut } from "../api/types";

// The backend does not expose GET /reimbursement-requests/{id}/audit yet
// (see base.md §6.4), so for requests we fall back to merging the audit
// trails of the request's expenses, newest first. Per-expense failures are
// skipped so one bad trail cannot take down the whole panel.
function mergeExpenseAudits(expenseIds: number[]): Promise<AuditEventOut[]> {
  return Promise.allSettled(expenseIds.map((eid) => getExpenseAudit(eid))).then((results) => {
    const seen = new Set<number>();
    return results
      .filter((r): r is PromiseFulfilledResult<AuditEventOut[]> => r.status === "fulfilled")
      .flatMap((r) => r.value)
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      })
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  });
}

export function AuditPanel({
  kind,
  id,
  expenseIds = [],
}: {
  kind: "expense" | "request";
  id: number;
  /** Only used for requests: ids of the request's expenses to aggregate. */
  expenseIds?: number[];
}) {
  const [events, setEvents] = useState<AuditEventOut[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError(false);
    if (!open) return;

    const load = kind === "expense" ? getExpenseAudit : getRequestAudit;
    load(id)
      .catch(() => {
        if (kind !== "request" || expenseIds.length === 0) throw new Error("unavailable");
        return mergeExpenseAudits(expenseIds);
      })
      .then((evts) => {
        if (!cancelled) setEvents(evts);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, kind, open, expenseIds]);

  return (
    <div className="mt-5 border-t border-line pt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
      >
        <ClockCounterClockwise size={15} aria-hidden />
        Activity
        <span className="text-ink-3">{open ? "" : "· view history"}</span>
      </button>
      {open && (
        <div className="mt-3">
          {error && (
            <p className="text-xs text-ink-3">History could not be loaded right now.</p>
          )}
          {events && events.length === 0 && (
            <p className="text-xs text-ink-3">No recorded activity.</p>
          )}
          {events && events.length > 0 && (
            <ul className="divide-y divide-line">
              {events.map((ev) => (
                <li key={ev.id} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">{auditLabel(ev.action)}</p>
                    <p className="text-[11px] text-ink-3">
                      {ev.actor_role === "manager" ? "Manager" : "Employee"}
                      {ev.comment ? (
                        <span className="italic"> · “{ev.comment}”</span>
                      ) : null}
                    </p>
                  </div>
                  <time className="shrink-0 text-[11px] text-ink-3">
                    {formatDateTime(ev.occurred_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ReceiptRow({
  filename,
  sizeBytes,
  uploadedAt,
  onDownload,
  onDelete,
}: {
  filename: string;
  sizeBytes: number;
  uploadedAt: string;
  onDownload: () => void;
  onDelete?: () => void;
}) {
  return (
    <li className="flex items-center gap-2.5 py-2">
      <span className="h-8 w-8 shrink-0 rounded-[8px] bg-panel-2" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">{filename}</p>
        <p className="text-[11px] text-ink-3">
          {humanSize(sizeBytes)} · {formatDateTime(uploadedAt)}
        </p>
      </div>
      <button
        onClick={onDownload}
        aria-label={`Download ${filename}`}
        title="Download"
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-hover hover:text-ink"
      >
        <FileArrowDown size={16} />
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          aria-label={`Delete ${filename}`}
          title="Delete"
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad"
        >
          <Trash size={15} />
        </button>
      )}
    </li>
  );
}

export function PlaceholderReceiptRow() {
  return (
    <li className="flex items-center gap-2.5 py-2">
      <div className="h-8 w-8 animate-pulse rounded-[8px] bg-hover" aria-hidden />
      <div className="flex-1">
        <div className="h-3 w-40 animate-pulse rounded bg-hover" />
        <div className="mt-1.5 h-2.5 w-24 animate-pulse rounded bg-hover" />
      </div>
      <DotsThree size={18} className="text-ink-3" />
    </li>
  );
}
