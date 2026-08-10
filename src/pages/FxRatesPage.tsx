import { useCallback, useEffect, useState } from "react";
import { CurrencyCircleDollar, PencilSimple } from "@phosphor-icons/react";
import { listFxRates, upsertFxRate } from "../api/endpoints";
import type { FxRateOut } from "../api/types";
import { ApiError } from "../api/client";
import { CURRENCIES } from "../lib/constants";
import { formatDate, todayISO } from "../lib/date";
import { isValidRate } from "../lib/money";
import { useSession } from "../store/session";
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

export default function FxRatesPage() {
  const { user } = useSession();
  const isManager = user?.role === "manager";

  const [rates, setRates] = useState<FxRateOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FxRateOut | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setError(null);
    listFxRates().then(setRates).catch((err) => {
      setRates(null);
      setError(err instanceof ApiError ? err.message : "Could not load FX rates.");
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">FX rates</h1>
          <p className="mt-0.5 text-[13px] text-ink-3">
            Units of currency per 1 USD. Rates are snapshotted onto expenses at submission.
          </p>
        </div>
        {isManager && (
          <Button variant="primary" onClick={() => setAdding(true)} icon={<CurrencyCircleDollar size={15} />}>
            Add rate
          </Button>
        )}
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {!error && rates === null && <PageSkeleton rows={5} />}
        {!error && rates !== null && rates.length === 0 && (
          <EmptyState
            icon={<CurrencyCircleDollar size={20} />}
            title="No rates yet"
            body="USD always converts at 1. Add rates for the other currencies your team spends in before they submit non-USD expenses."
            action={
              isManager ? (
                <Button variant="primary" onClick={() => setAdding(true)}>
                  Add rate
                </Button>
              ) : undefined
            }
          />
        )}
        {rates !== null && rates.length > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-[11px] font-medium uppercase tracking-wide text-ink-3">
                <th scope="col" className="px-4 py-2.5 font-medium">Currency</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Rate per USD</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Effective</th>
                {isManager && <th scope="col" className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {/* USD is always 1 */}
              <tr className="text-sm">
                <td className="px-4 py-2.5 font-medium text-ink">USD</td>
                <td className="px-4 py-2.5 font-mono tnum text-ink">1.00000000</td>
                <td className="px-4 py-2.5 text-ink-3">Fixed</td>
                {isManager && <td className="px-4 py-2.5" />}
              </tr>
              {rates.map((r) => (
                <tr key={r.id} className="text-sm">
                  <td className="px-4 py-2.5 font-medium text-ink">{r.currency}</td>
                  <td className="px-4 py-2.5 font-mono tnum text-ink">{r.rate}</td>
                  <td className="px-4 py-2.5 text-ink-3">{formatDate(r.effective_date)}</td>
                  {isManager && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setEditing(r)}
                        aria-label={`Update rate for ${r.currency}`}
                        className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink"
                      >
                        <PencilSimple size={13} />
                        Update
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isManager && (
        <>
          <RateModal
            open={adding}
            mode="add"
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              load();
            }}
          />
          <RateModal
            open={editing !== null}
            mode="edit"
            rate={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        </>
      )}
    </div>
  );
}

function RateModal({
  open,
  mode,
  rate,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "add" | "edit";
  rate?: FxRateOut | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [currency, setCurrency] = useState("EUR");
  const [value, setValue] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && rate) {
      setCurrency(rate.currency);
      setValue(rate.rate);
      setEffectiveDate(rate.effective_date);
      setError(null);
    } else if (open) {
      setCurrency("EUR");
      setValue("");
      setEffectiveDate(todayISO());
      setError(null);
    }
  }, [open, rate]);

  const save = async () => {
    if (!isValidRate(value)) {
      setError("Enter a positive rate (up to 8 decimals).");
      return;
    }
    if (!effectiveDate) {
      setError("Pick an effective date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertFxRate(currency, { rate: value.trim(), effective_date: effectiveDate });
      onSaved();
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : "Could not save the rate.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "add" ? "Add FX rate" : `Update ${rate?.currency} rate`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={busy}>
            Save rate
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        {mode === "add" ? (
          <Field label="Currency" htmlFor="fx-currency" hint="Units of currency per 1 USD.">
            <Select id="fx-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="rounded-[10px] border border-line bg-panel-2/50 px-3.5 py-2.5 text-sm text-ink-2">
            Updating the rate for <span className="font-medium text-ink">{rate?.currency}</span>. A
            new point replaces the old one for the same effective date.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Rate" htmlFor="fx-rate" hint="e.g. 0.95 (EUR per USD)">
            <Input
              id="fx-rate"
              inputMode="decimal"
              placeholder="0.00000000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <Field label="Effective date" htmlFor="fx-date">
            <Input
              id="fx-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}