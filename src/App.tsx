import { Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider, useSession } from "./store/session";
import AppShell from "./components/AppShell";
import { PageSkeleton } from "./components/ui";
import type { Role } from "./api/types";
import LoginPage from "./pages/LoginPage";
import ExpensesPage from "./pages/ExpensesPage";
import RequestsPage from "./pages/RequestsPage";
import RequestDetailPage from "./pages/RequestDetailPage";
import ReviewPage from "./pages/ReviewPage";
import ApprovedPage from "./pages/ApprovedPage";
import DashboardPage from "./pages/DashboardPage";
import FxRatesPage from "./pages/FxRatesPage";

function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useSession();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useSession();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "manager" ? "/review" : "/expenses"} replace />;
}

function AppRoutes() {
  const { user, booting } = useSession();

  if (booting) {
    return (
      <div className="min-h-[100dvh] px-6 py-8 md:pl-[248px]">
        <PageSkeleton rows={8} />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppShell />}>
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/requests" element={<RequireRole roles={["employee"]}><RequestsPage /></RequireRole>} />
        <Route path="/requests/:id" element={<RequestDetailPage />} />
        <Route path="/review" element={<RequireRole roles={["manager"]}><ReviewPage /></RequireRole>} />
        <Route path="/approved" element={<RequireRole roles={["manager"]}><ApprovedPage /></RequireRole>} />
        <Route path="/dashboard" element={<RequireRole roles={["manager"]}><DashboardPage /></RequireRole>} />
        <Route path="/fx" element={<FxRatesPage />} />
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <AppRoutes />
    </SessionProvider>
  );
}