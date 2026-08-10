import { formatMoney } from "../lib/money";

/** Money always renders in mono, tabular digits so columns line up. */
export function Money({
  amount,
  currency,
  className = "",
  muted = false,
}: {
  amount: string | null;
  currency: string;
  className?: string;
  muted?: boolean;
}) {
  if (amount === null || amount === undefined) return <span className={className} />;
  return (
    <span
      className={`font-mono tnum ${muted ? "text-ink-3" : "text-ink"} ${className}`}
    >
      {formatMoney(amount, currency)}
    </span>
  );
}

/** Original amount + converted base line for non-USD rows. */
export function AmountWithBase({
  amount,
  currency,
  baseAmount,
  fxRate,
  className = "",
}: {
  amount: string;
  currency: string;
  baseAmount: string | null;
  fxRate?: string | null;
  className?: string;
}) {
  if (currency === "USD" || !baseAmount) {
    return <Money amount={amount} currency={currency} className={className} />;
  }
  return (
    <div className={`flex flex-col items-end gap-0.5 ${className}`}>
      <Money amount={amount} currency={currency} />
      <span className="font-mono tnum text-[11px] text-ink-3" title={fxRate ? `Rate ${fxRate} per USD` : undefined}>
        ≈ {formatMoney(baseAmount, "USD")}
      </span>
    </div>
  );
}
