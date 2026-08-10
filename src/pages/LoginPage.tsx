import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Lock, SignIn } from "@phosphor-icons/react";
import { useSession } from "../store/session";
import { ApiError } from "../api/client";
import { Field, Input, Button, ErrorBanner } from "../components/ui";

const DEMO_ACCOUNTS = [
  { email: "employee@example.com", label: "Employee" },
  { email: "manager@example.com", label: "Manager" },
  { email: "finemployee@example.com", label: "Finance employee" },
  { email: "finmanager@example.com", label: "Finance manager" },
];

export default function LoginPage() {
  const { login } = useSession();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sessionExpired = searchParams.get("reason") === "session";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not sign in. Check that the backend is running.",
      );
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden>
            <rect width="32" height="32" rx="8" fill="#059669" />
            <path
              d="M10 9h8.2a4.8 4.8 0 0 1 0 9.6H13v4.4a1 1 0 0 1-2 0V10a1 1 0 0 1 1-1h-2zm3 2.4v4.8h5.2a2.4 2.4 0 0 0 0-4.8H13z"
              fill="white"
            />
          </svg>
          <div className="text-center">
            <h1 className="text-lg font-semibold tracking-tight text-ink">dashSpend</h1>
            <p className="mt-0.5 text-sm text-ink-3">Sign in to submit and review expenses.</p>
          </div>
        </div>

        {sessionExpired && (
          <div className="mb-4">
            <ErrorBanner message="Your session expired. Sign in again to continue." />
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-5 shadow-sm shadow-black/[0.03]">
          {error && <ErrorBanner message={error} />}
          <Field label="Email" htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password" htmlFor="login-password">
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button variant="primary" type="submit" loading={busy} icon={<Lock size={15} />} className="mt-1">
            Sign in
          </Button>
        </form>

        <div className="mt-5 rounded-xl border border-line bg-panel px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
            <SignIn size={13} aria-hidden />
            Demo accounts
          </p>
          <ul className="mt-2 space-y-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword("password123");
                    setError(null);
                  }}
                  className="group flex w-full items-center justify-between rounded-[8px] px-1.5 py-1 text-left text-xs transition-colors hover:bg-hover"
                >
                  <span className="text-ink-3 group-hover:text-ink">{a.label}</span>
                  <span className="font-mono text-[11px] text-ink-3">{a.email}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1.5 text-[11px] text-ink-3">Password for all demo accounts: password123</p>
        </div>
      </div>
    </div>
  );
}
