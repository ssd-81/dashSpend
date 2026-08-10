import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  CheckCircle,
  CurrencyCircleDollar,
  Moon,
  PaperPlaneTilt,
  Receipt,
  SignOut,
  SquaresFour,
  Sun,
  Tray,
} from "@phosphor-icons/react";
import { useSession } from "../store/session";
import type { Role } from "../api/types";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: Role[];
  group?: string;
};

const NAV: NavItem[] = [
  { to: "/expenses", label: "Expenses", icon: <Receipt size={17} />, roles: ["employee", "manager"] },
  { to: "/requests", label: "Requests", icon: <PaperPlaneTilt size={17} />, roles: ["employee"] },
  { to: "/review", label: "Review queue", icon: <Tray size={17} />, roles: ["manager"] },
  { to: "/approved", label: "Approved", icon: <CheckCircle size={17} />, roles: ["manager"] },
  {
    to: "/dashboard",
    label: "Department",
    icon: <SquaresFour size={17} />,
    roles: ["manager"],
    group: "Team",
  },
  {
    to: "/fx",
    label: "FX rates",
    icon: <CurrencyCircleDollar size={17} />,
    roles: ["employee", "manager"],
    group: "Admin",
  },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("dashspend.theme", next ? "dark" : "light");
    } catch {
      /* noop */
    }
  };
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="flex h-8 w-8 items-center justify-center rounded-[10px] text-ink-3 transition-colors hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#059669" />
        <path
          d="M10 9h8.2a4.8 4.8 0 0 1 0 9.6H13v4.4a1 1 0 0 1-2 0V10a1 1 0 0 1 1-1h-2zm3 2.4v4.8h5.2a2.4 2.4 0 0 0 0-4.8H13z"
          fill="white"
        />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-ink">dashSpend</span>
    </div>
  );
}

function UserCard() {
  const { user, logout } = useSession();
  const loc = useLocation();
  const onLogin = loc.pathname === "/login";
  if (!user || onLogin) return null;
  return (
    <div className="flex items-center gap-2.5 border-t border-line px-2 pt-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-xs font-semibold text-accent">
        {initials(user.full_name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight text-ink">{user.full_name}</p>
        <p className="truncate text-[11px] leading-tight text-ink-3">
          {user.role === "manager" ? "Manager" : "Employee"}
          {user.department_name ? ` · ${user.department_name}` : ""}
        </p>
      </div>
      <button
        onClick={logout}
        aria-label="Sign out"
        title="Sign out"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-ink-3 transition-colors hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
      >
        <SignOut size={16} />
      </button>
    </div>
  );
}

export default function AppShell() {
  const { user } = useSession();
  const role = user?.role ?? "employee";
  const items = NAV.filter((n) => n.roles.includes(role));

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors duration-150 ${
      isActive
        ? "bg-accent-soft text-accent"
        : "text-ink-2 hover:bg-hover hover:text-ink"
    }`;

  return (
    <div className="min-h-[100dvh]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[224px] flex-col border-r border-line bg-panel px-3 py-4 md:flex">
        <Brand />
        <nav className="mt-6 flex flex-1 flex-col gap-0.5" aria-label="Primary">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass} end={item.to === "/expenses"}>
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between px-2 pb-3">
          <ThemeToggle />
        </div>
        <UserCard />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-panel px-4 md:hidden">
        <Brand />
        <ThemeToggle />
      </header>

      {/* Content */}
      <main className="md:pl-[224px]">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-10">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line bg-panel px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Primary"
      >
        {items.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/expenses"}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                isActive ? "text-accent" : "text-ink-3"
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}