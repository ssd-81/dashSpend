import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Lock, SignIn, UserPlus, WarningCircle } from "@phosphor-icons/react";
import { useSession } from "../store/session";
import { ApiError } from "../api/client";
import { listDepartments } from "../api/endpoints";
import type { DepartmentOut, Role } from "../api/types";
import { Field, Input, Button, ErrorBanner, Select } from "../components/ui";

type Mode = "signin" | "signup";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login, register } = useSession();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sign-in fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sign-up fields
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Departments for the sign-up dropdown (public endpoint, no auth needed).
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [deptError, setDeptError] = useState<string | null>(null);

  const loadDepartments = useCallback(async () => {
    setDeptError(null);
    try {
      setDepartments(await listDepartments());
    } catch (err) {
      setDeptError(err instanceof ApiError ? err.message : "Could not load departments.");
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const sessionExpired = searchParams.get("reason") === "session";

  const deptPlaceholder = deptError
    ? "Departments unavailable"
    : departments.length
      ? "Choose a department…"
      : "Loading departments…";

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setFieldErrors({});
    setBusy(false);
  };

  const submitSignin = async (e: FormEvent) => {
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

  const submitSignup = async (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.full_name = "Enter your full name.";
    if (!EMAIL_RE.test(signupEmail.trim())) errors.email = "Enter a valid email address.";
    if (signupPassword.length < 8) errors.password = "Use at least 8 characters.";
    if (!departmentId) errors.department_id = "Choose a department.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setBusy(true);
    setError(null);
    try {
      await register({
        email: signupEmail.trim(),
        password: signupPassword,
        full_name: fullName.trim(),
        department_id: Number(departmentId),
        role,
      });
      // Registration auto-signs-in; the router redirects into the app.
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError) {
        // 422 validation errors map to individual fields (e.g. password too
        // short, unknown department). Everything else goes to the banner.
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
        else setError(err.message);
      } else {
        setError("Could not create your account. Check that the backend is running.");
      }
    }
  };

  const tabClass = (active: boolean) =>
    `flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring ${
      active
        ? "bg-panel text-ink shadow-sm ring-1 ring-line"
        : "text-ink-2 hover:text-ink"
    }`;

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
            <p className="mt-0.5 text-sm text-ink-3">Submit expenses, get reimbursed.</p>
          </div>
        </div>

        {sessionExpired && mode === "signin" && (
          <div className="mb-4">
            <ErrorBanner message="Your session expired. Sign in again to continue." />
          </div>
        )}

        <div className="rounded-xl border border-line bg-panel p-5 shadow-sm shadow-black/[0.03]">
          <div
            className="mb-5 grid grid-cols-2 gap-1 rounded-[10px] bg-panel-2 p-1"
            aria-label="Account access"
          >
            <button
              type="button"
              aria-pressed={mode === "signin"}
              onClick={() => switchMode("signin")}
              className={tabClass(mode === "signin")}
            >
              <SignIn size={15} aria-hidden />
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={mode === "signup"}
              onClick={() => switchMode("signup")}
              className={tabClass(mode === "signup")}
            >
              <UserPlus size={15} aria-hidden />
              Create account
            </button>
          </div>

          {mode === "signin" ? (
            <form onSubmit={submitSignin} className="flex flex-col gap-4">
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
          ) : (
            <form onSubmit={submitSignup} className="flex flex-col gap-4">
              {error && <ErrorBanner message={error} />}
              <Field label="Full name" htmlFor="signup-full-name" error={fieldErrors.full_name}>
                <Input
                  id="signup-full-name"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>
              <Field label="Email" htmlFor="signup-email" error={fieldErrors.email}>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                />
              </Field>
              <Field
                label="Password"
                htmlFor="signup-password"
                hint="At least 8 characters."
                error={fieldErrors.password}
              >
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                />
              </Field>
              <Field label="Department" htmlFor="signup-department" error={fieldErrors.department_id}>
                <Select
                  id="signup-department"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={deptError !== null}
                >
                  <option value="">{deptPlaceholder}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
                {deptError && (
                  <p className="flex items-center gap-1 text-xs font-medium text-bad">
                    <WarningCircle size={13} weight="fill" aria-hidden />
                    {deptError}
                    <button
                      type="button"
                      onClick={loadDepartments}
                      className="font-semibold underline underline-offset-2 hover:opacity-80"
                    >
                      Retry
                    </button>
                  </p>
                )}
              </Field>
              <Field label="Role" hint="You can pick either role for now.">
                <div className="grid grid-cols-2 gap-2">
                  {(["employee", "manager"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      aria-pressed={role === r}
                      className={`rounded-[10px] border px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring ${
                        role === r
                          ? "border-accent bg-accent-soft ring-2 ring-accent-ring"
                          : "border-line-2 bg-panel hover:bg-hover"
                      }`}
                    >
                      <p className="text-[13px] font-medium text-ink">
                        {r === "manager" ? "Manager" : "Employee"}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-ink-3">
                        {r === "manager" ? "Review & approve requests" : "Submit expenses & requests"}
                      </p>
                    </button>
                  ))}
                </div>
              </Field>
              <Button variant="primary" type="submit" loading={busy} icon={<UserPlus size={15} />} className="mt-1">
                Create account
              </Button>
              <p className="text-center text-xs text-ink-3">You'll be signed in automatically.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
