import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";

// Radius system (documented): controls (buttons, inputs) use 10px,
// container surfaces (panels, modals) use 12px, status chips are pill.
// No other radii on the page.

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-strong focus-visible:ring-accent-ring disabled:opacity-50",
  secondary:
    "bg-panel text-ink border border-line-2 hover:bg-hover focus-visible:ring-accent-ring disabled:opacity-50",
  ghost:
    "text-ink-2 hover:text-ink hover:bg-hover focus-visible:ring-accent-ring disabled:opacity-50",
  danger: "bg-[#e11d48] text-white hover:bg-[#be123c] focus-visible:ring-[#e11d48]/40 disabled:opacity-50",
};

export function Button({
  variant = "secondary",
  icon,
  loading,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex h-9 select-none items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-sm font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ${VARIANT_CLASS[variant]} ${className}`}
    >
      {loading ? (
        <CircleNotch size={16} className="animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/** Small square icon button (row actions). */
export function IconButton({
  label,
  icon,
  tone = "default",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring ${
        tone === "danger"
          ? "text-ink-3 hover:bg-bad-soft hover:text-bad"
          : "text-ink-3 hover:bg-hover hover:text-ink"
      } ${className}`}
    >
      {icon}
    </button>
  );
}

/* ------------------------------- Form fields ------------------------------- */

const FIELD_BASE =
  "w-full rounded-[10px] border border-line-2 bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-3 transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring disabled:opacity-60 dark:bg-panel-2";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${FIELD_BASE} ${className}`} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={`${FIELD_BASE} min-h-20 resize-y ${className}`} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${FIELD_BASE} pr-8 ${className}`}>
      {children}
    </select>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-xs font-medium text-bad">
          <WarningCircle size={13} weight="fill" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------- Badge ---------------------------------- */

export type BadgeTone = "ok" | "warn" | "bad" | "mute" | "accent";

const BADGE_TONE: Record<BadgeTone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  mute: "bg-mute-soft text-mute",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

/* ---------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Callers pass inline onClose functions, so keep the latest in a ref and
  // make the effect below depend only on `open`. Depending on `onClose` would
  // re-run the focus trap on every parent re-render (e.g. while typing in a
  // field), yanking focus back to the first focusable element.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Move focus into the panel for keyboard users. Skip the close button so
    // form modals land on the first control instead.
    requestAnimationFrame(() => {
      const el = panelRef.current;
      if (!el) return;
      const closeBtn = el.querySelector<HTMLElement>('button[aria-label="Close"]');
      const focusable = el.querySelectorAll<HTMLElement>(
        "input:not([type='hidden']), select, textarea, button, [tabindex]:not([tabindex='-1'])",
      );
      for (const f of focusable) {
        const ctrl = f as HTMLElement & { disabled?: boolean };
        if (f !== closeBtn && !ctrl.disabled) {
          f.focus();
          return;
        }
      }
      el.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : "Dialog"}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`max-h-[92dvh] w-full ${width} overflow-y-auto rounded-t-xl border border-line bg-panel shadow-2xl shadow-black/10 dark:shadow-black/40 sm:rounded-xl`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-panel-2/60 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Skeletons ------------------------------- */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-hover ${className}`} aria-hidden />;
}

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

/* ------------------------------- Empty state ------------------------------- */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-panel-2 text-ink-3">
        {icon}
      </div>
      <p className="mt-1 text-sm font-semibold text-ink">{title}</p>
      {body && <p className="max-w-sm text-[13px] leading-relaxed text-ink-3">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ------------------------------- Error banner ------------------------------ */

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-[10px] border border-bad/25 bg-bad-soft px-3.5 py-3 text-[13px] text-bad"
    >
      <WarningCircle size={17} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
      <div className="flex-1 leading-relaxed">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/* ------------------------------ Confirm dialog ----------------------------- */

export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  onConfirm,
  onClose,
  busy,
  children,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <div className="text-sm leading-relaxed text-ink-2">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
