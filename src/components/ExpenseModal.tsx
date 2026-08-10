import { useEffect, useRef, useState } from "react";
import { CloudArrowUp, LinkSimple, Paperclip } from "@phosphor-icons/react";
import { createExpense, deleteExpense, deleteReceipt, downloadReceipt, getExpense, updateExpense, uploadReceipt } from "../api/endpoints";
import type { ExpenseCreate, ExpenseOut } from "../api/types";
import { ApiError } from "../api/client";
import { CATEGORIES, CURRENCIES } from "../lib/constants";
import { formatDate } from "../lib/date";
import { formatMoney, isValidAmount } from "../lib/money";
import { AmountWithBase } from "./Money";
import { ExpenseStatusBadge } from "./StatusBadge";
import { AuditPanel, PlaceholderReceiptRow, ReceiptRow } from "./AuditPanel";
import {
  Button,
  ConfirmDialog,
  ErrorBanner,
  Field,
  Input,
  Modal,
  PageSkeleton,
  Select,
  Textarea,
} from "./ui";
import { useSession } from "../store/session";

type FormState = {
  category: string;
  amount: string;
  currency: string;
  occurred_at: string;
  description: string;
  vendor: string;
};

const EMPTY_FORM: FormState = {
  category: "Meals",
  amount: "",
  currency: "USD",
  occurred_at: "",
  description: "",
  vendor: "",
};

function formFromExpense(e: ExpenseOut): FormState {
  return {
    category: e.category,
    amount: e.amount,
    currency: e.currency,
    occurred_at: e.occurred_at,
    description: e.description,
    vendor: e.vendor ?? "",
  };
}

export default function ExpenseModal({
  open,
  expenseId,
  onClose,
  onChanged,
}: {
  open: boolean;
  expenseId: number | null; // null = create
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useSession();
  const [createdId, setCreatedId] = useState<number | null>(null);
  const id = expenseId ?? createdId;

  const [expense, setExpense] = useState<ExpenseOut | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isCreate = id === null;
  const isDraft = expense?.status === "draft";

  // Reset internal state whenever the modal opens with a different target.
  const load = (targetId: number) => {
    setLoadError(null);
    setExpense(null);
    getExpense(targetId)
      .then((e) => {
        setExpense(e);
        setForm(formFromExpense(e));
      })
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : "Could not load this expense."),
      );
  };

  useEffect(() => {
    if (!open) return;
    setBanner(null);
    setFieldErrors({});
    setCreatedId((prev) => (expenseId ? null : prev));
    if (expenseId) {
      load(expenseId);
    } else {
      setExpense(null);
      setForm({ ...EMPTY_FORM, occurred_at: new Date().toISOString().slice(0, 10) });
    }
  }, [open, expenseId]);

  const close = () => {
    setCreatedId(null);
    onClose();
  };

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!isValidAmount(form.amount)) {
      errs.amount = "Enter a positive amount with up to 2 decimals.";
    }
    if (!form.category) errs.category = "Choose a category.";
    if (!form.occurred_at) errs.occurred_at = "Pick the date it happened.";
    else if (form.occurred_at > new Date().toISOString().slice(0, 10)) {
      errs.occurred_at = "The date cannot be in the future.";
    }
    if (!form.description.trim()) errs.description = "Add a short description.";
    if (form.vendor.length > 200) errs.vendor = "Keep the vendor under 200 characters.";
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    setBanner(null);
    try {
      if (isCreate) {
        const body: ExpenseCreate = {
          category: form.category,
          amount: form.amount.trim(),
          currency: form.currency,
          occurred_at: form.occurred_at,
          description: form.description.trim(),
          vendor: form.vendor.trim() || null,
        };
        const created = await createExpense(body);
        setCreatedId(created.id);
        setExpense(created);
        onChanged();
      } else if (expense) {
        // Send only changed fields (PATCH is partial).
        const patch: Partial<ExpenseCreate> = {};
        const prev = formFromExpense(expense);
        (Object.keys(form) as (keyof FormState)[]).forEach((k) => {
          const next = k === "vendor" ? form[k].trim() || null : form[k];
          if (String(next) !== String(prev[k])) {
            (patch as Record<string, unknown>)[k] = next;
          }
        });
        if (Object.keys(patch).length > 0) {
          const updated = await updateExpense(expense.id, patch);
          setExpense(updated);
          setForm(formFromExpense(updated));
          onChanged();
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
        if (err.code === "conflict") {
          // Someone submitted it while we were editing: reload and go read-only.
          if (expense) {
            try {
              const fresh = await getExpense(expense.id);
              setExpense(fresh);
              onChanged();
            } catch {
              /* keep local state */
            }
          }
          setBanner(err.message);
        } else {
          setBanner(err.message);
        }
      } else {
        setBanner("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!expense || !isDraft) return;
    setDeleting(true);
    try {
      await deleteExpense(expense.id);
      setConfirmDelete(false);
      onChanged();
      close();
    } catch (err) {
      setDeleting(false);
      setBanner(err instanceof ApiError ? err.message : "Could not delete this expense.");
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !expense) return;
    setUploading(true);
    setBanner(null);
    try {
      const receipt = await uploadReceipt(expense.id, file);
      setExpense({ ...expense, receipts: [...expense.receipts, receipt] });
      onChanged();
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : "Upload failed. Choose a PDF, PNG or JPG under 5 MB.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDeleteReceipt = async (receiptId: number) => {
    if (!expense) return;
    try {
      await deleteReceipt(expense.id, receiptId);
      setExpense({ ...expense, receipts: expense.receipts.filter((r) => r.id !== receiptId) });
      onChanged();
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : "Could not remove the receipt.");
    }
  };

  // ---- Create mode: blank form ------------------------------------------------
  const createBody = (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="exp-category" error={fieldErrors.category}>
          <Select id="exp-category" value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount" htmlFor="exp-amount" error={fieldErrors.amount}>
          <Input
            id="exp-amount"
            inputMode="decimal"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => set({ amount: e.target.value })}
          />
        </Field>
        <Field label="Currency" htmlFor="exp-currency" error={fieldErrors.currency}>
          <Select id="exp-currency" value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="exp-date" error={fieldErrors.occurred_at}>
          <Input
            id="exp-date"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.occurred_at}
            onChange={(e) => set({ occurred_at: e.target.value })}
          />
        </Field>
        <Field label="Description" htmlFor="exp-desc" error={fieldErrors.description}>
          <Input
            id="exp-desc"
            placeholder="Client dinner"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>
        <Field label="Vendor" htmlFor="exp-vendor" hint="Optional" error={fieldErrors.vendor}>
          <Input
            id="exp-vendor"
            placeholder="La Trattoria"
            value={form.vendor}
            onChange={(e) => set({ vendor: e.target.value })}
          />
        </Field>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-ink-3">
        New expenses start as drafts. You can edit them and attach receipts until you submit them
        with a reimbursement request.
      </p>
    </>
  );

  // ---- View mode ---------------------------------------------------------------
  let viewBody: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (isCreate) {
    footer = (
      <>
        <Button onClick={close} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Create expense
        </Button>
      </>
    );
  } else if (loadError) {
    viewBody = (
      <div className="py-6">
        <ErrorBanner message={loadError} onRetry={() => id && load(id)} />
      </div>
    );
    footer = (
      <Button onClick={close}>Close</Button>
    );
  } else if (!expense) {
    viewBody = <PageSkeleton rows={4} />;
    footer = <Button onClick={close}>Close</Button>;
  } else {
    const requestLink = expense.request_id ? `/requests/${expense.request_id}` : null;
    const showEdit = isDraft;
    viewBody = (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ExpenseStatusBadge status={expense.status} />
            {requestLink && (
              <a
                href={requestLink}
                className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <LinkSimple size={13} />
                Request #{expense.request_id}
              </a>
            )}
          </div>
          {expense.status === "draft" && (
            <span className="text-xs text-ink-3">Created {formatDate(expense.created_at)}</span>
          )}
        </div>

        {!showEdit && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Category</p>
              <p className="mt-1 text-sm text-ink">{expense.category}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Date</p>
              <p className="mt-1 text-sm text-ink">{formatDate(expense.occurred_at)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Amount</p>
              <div className="mt-1">
                <AmountWithBase
                  amount={expense.amount}
                  currency={expense.currency}
                  baseAmount={expense.base_amount}
                  fxRate={expense.fx_rate_to_base}
                />
              </div>
              {expense.currency !== "USD" && expense.base_amount && (
                <p className="mt-1 text-xs text-ink-3">
                  Converted at {formatDate(expense.converted_at ?? expense.occurred_at)} using rate{" "}
                  {expense.fx_rate_to_base} {expense.currency} per USD.
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Description</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{expense.description}</p>
            </div>
            {expense.vendor && (
              <div className="sm:col-span-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Vendor</p>
                <p className="mt-1 text-sm text-ink">{expense.vendor}</p>
              </div>
            )}
          </div>
        )}

        {showEdit && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="exp-category" error={fieldErrors.category}>
              <Select
                id="exp-category"
                value={form.category}
                onChange={(e) => set({ category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount" htmlFor="exp-amount" error={fieldErrors.amount}>
              <Input
                id="exp-amount"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => set({ amount: e.target.value })}
              />
            </Field>
            <Field label="Currency" htmlFor="exp-currency">
              <Select
                id="exp-currency"
                value={form.currency}
                onChange={(e) => set({ currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date" htmlFor="exp-date" error={fieldErrors.occurred_at}>
              <Input
                id="exp-date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.occurred_at}
                onChange={(e) => set({ occurred_at: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="exp-desc" error={fieldErrors.description}>
                <Textarea
                  id="exp-desc"
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Vendor" htmlFor="exp-vendor" hint="Optional" error={fieldErrors.vendor}>
                <Input
                  id="exp-vendor"
                  value={form.vendor}
                  onChange={(e) => set({ vendor: e.target.value })}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Receipts */}
        <div className="border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
              <Paperclip size={15} aria-hidden />
              Receipts
              <span className="font-mono tnum text-ink-3">{expense.receipts.length}</span>
            </p>
            {isDraft && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  className="hidden"
                  aria-hidden
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <Button
                  className="h-8 px-2.5 text-[13px]"
                  onClick={() => fileRef.current?.click()}
                  loading={uploading}
                  disabled={uploading}
                  icon={<CloudArrowUp size={14} />}
                >
                  Add receipt
                </Button>
              </>
            )}
          </div>
          {uploading && <PlaceholderReceiptRow />}
          {expense.receipts.length === 0 && !uploading && (
            <p className="mt-2 text-xs text-ink-3">
              {isDraft
                ? "No receipts yet. Attach a PDF, PNG or JPG up to 5 MB."
                : "No receipts were attached."}
            </p>
          )}
          <ul className="mt-1 divide-y divide-line">
            {expense.receipts.map((r) => (
              <ReceiptRow
                key={r.id}
                filename={r.filename}
                sizeBytes={r.size_bytes}
                uploadedAt={r.uploaded_at}
                onDownload={() => downloadReceipt(expense.id, r.id, r.filename)}
                onDelete={isDraft ? () => handleDeleteReceipt(r.id) : undefined}
              />
            ))}
          </ul>
        </div>

        {isDraft && <AuditPanel kind="expense" id={expense.id} />}
      </div>
    );

    footer = isDraft ? (
      <>
        {user?.role === "manager" ? null : (
          <Button
            variant="ghost"
            className="mr-auto text-bad hover:bg-bad-soft"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        )}
        <Button onClick={close} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Save changes
        </Button>
      </>
    ) : (
      <Button onClick={close}>Close</Button>
    );
  }

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        title={isCreate ? "New expense" : expense ? "Expense" : "Expense"}
        footer={footer}
      >
        {banner && (
          <div className="mb-4">
            <ErrorBanner message={banner} />
          </div>
        )}
        {isCreate ? createBody : viewBody}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete expense"
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={handleDelete}
      >
        <p>Permanently delete “{expense?.description}” ({formatMoney(expense?.amount ?? "0", expense?.currency ?? "USD")})?</p>
        <p className="mt-1 text-xs text-ink-3">This cannot be undone.</p>
      </ConfirmDialog>
    </>
  );
}