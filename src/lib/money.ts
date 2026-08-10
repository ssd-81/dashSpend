// Money helpers. All amounts arrive as strings ("42.50"). We only ever do
// integer-cents math so floating point never touches a balance.

export const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;

export function isValidAmount(s: string): boolean {
  if (!AMOUNT_RE.test(s)) return false;
  return Number(s) > 0;
}

// FX rates allow up to 8 decimal places (units of currency per 1 USD).
const RATE_RE = /^\d{1,12}(\.\d{1,8})?$/;

export function isValidRate(s: string): boolean {
  if (!RATE_RE.test(s)) return false;
  return Number(s) > 0;
}

/** "42.50" -> 4250, "120" -> 12000. String math only, no float parsing. */
export function toCents(s: string): number {
  const [whole = "0", frac = ""] = s.split(".");
  const padded = (frac + "00").slice(0, 2);
  return parseInt(whole, 10) * 100 + parseInt(padded || "0", 10);
}

/** Sum of amounts as a 2dp string. */
export function sumMoney(values: string[]): string {
  const total = values.reduce((acc, v) => acc + toCents(v), 0);
  return `${Math.floor(total / 100)}.${String(total % 100).padStart(2, "0")}`;
}

const cached = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: string, currency: string): string {
  const key = `${currency}`;
  let fmt = cached.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      fmt = null as unknown as Intl.NumberFormat;
    }
    if (fmt) cached.set(key, fmt);
  }
  try {
    return fmt.format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
}

/** Plain 2dp string with no symbol, e.g. "184.21". */
export function plainAmount(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return n.toFixed(2);
}
