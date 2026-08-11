import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, clearSession, setToken } from "../api/client";
import { fetchMe, login as apiLogin, register as apiRegister } from "../api/endpoints";
import type { RegisterIn, UserOut } from "../api/types";

interface SessionState {
  user: UserOut | null;
  /** true while the stored token is being validated against /users/me */
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Create an account, then sign in with the fresh credentials. */
  register: (body: RegisterIn) => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [booting, setBooting] = useState(true);

  // Validate any stored token on app start.
  useEffect(() => {
    const token = localStorage.getItem("dashspend.token");
    if (!token) {
      setBooting(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setBooting(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email.trim(), password);
    setToken(res.access_token);
    const me = await fetchMe();
    setUser(me);
  }, []);

  const register = useCallback(async (body: RegisterIn) => {
    // /auth/register does not issue a token, so sign in right after.
    await apiRegister(body);
    try {
      const res = await apiLogin(body.email, body.password);
      setToken(res.access_token);
      const me = await fetchMe();
      setUser(me);
    } catch {
      // The account exists even if auto-login fails — don't let the caller
      // present this as a failed registration (which would suggest a 409
      // retry). Nudge the user toward signing in instead.
      throw new ApiError(0, "account_created", "Your account was created. Sign in to continue.");
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    window.location.assign("/login");
  }, []);

  const value = useMemo(
    () => ({ user, booting, login, register, logout }),
    [user, booting, login, register, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
