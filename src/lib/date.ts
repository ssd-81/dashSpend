// Date and period helpers. The API sends ISO strings: "2025-06-10" (date)
// and "2025-06-10T14:32:11+00:00" (datetime). We format in the browser's
// local timezone and locale.

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function currentPeriod(): string {
  return todayISO().slice(0, 7);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2025-06" -> "June 2025" */
export function formatPeriod(p: string): string {
  const [y, m] = p.split("-");
  const idx = parseInt(m, 10) - 1;
  if (!y || Number.isNaN(idx) || idx < 0 || idx > 11) return p;
  return `${MONTHS[idx]} ${y}`;
}

/** "2025-06-10" -> "Jun 10, 2025" */
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** ISO datetime -> "Jun 10, 2025, 11:02 AM" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "2025-06" -> "2025-06-01" (first day, for date inputs) */
export function periodStart(p: string): string {
  return `${p}-01`;
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
