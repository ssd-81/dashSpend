import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clearSession, setToken } from "../api/client";
import { fetchMe, login as apiLogin } from "../api/endpoints";
import type { UserOut } from "../api/types";

interface SessionState {
  user: UserOut | null;
  /** true while the stored token is being validated against /users/me */
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
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

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    window.location.assign("/login");
  }, []);

  const value = useMemo(() => ({ user, booting, login, logout }), [user, booting, login, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
