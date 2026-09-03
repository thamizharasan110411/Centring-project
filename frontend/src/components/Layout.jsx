import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/assets', label: 'Assets', icon: '🧱' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/rentals', label: 'Rentals', icon: '📦' },
  { to: '/returns', label: 'Returns', icon: '↩️' },
  { to: '/overdue', label: 'Overdue', icon: '⏰' },
  { to: '/invoices', label: 'Billing', icon: '🧾' },
  { to: '/payments', label: 'Payments', icon: '💳' },
  { to: '/reports', label: 'Reports', icon: '📈' },
];

function SidebarContent({ onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">🏗️</div>
        <div>
          <p className="text-sm font-bold leading-tight text-white">Centring Materials</p>
          <p className="text-[11px] text-slate-400">Rental ERP</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            end={item.to === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-800 px-5 py-4 text-[11px] leading-relaxed text-slate-500">
        Centering Material<br />Rental ERP v1.0
      </div>
    </div>
  );
}

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/assets': 'Assets',
  '/customers': 'Customers',
  '/rentals': 'Rentals',
  '/returns': 'Returns',
  '/overdue': 'Overdue',
  '/invoices': 'Billing',
  '/payments': 'Payments',
  '/reports': 'Reports',
};

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { admin, logout } = useAuth();
  const location = useLocation();
  const current = NAV.find((n) =>
    location.pathname === n.to || (n.to !== '/dashboard' && location.pathname.startsWith(n.to))
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 bg-slate-900 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-60 bg-slate-900 shadow-2xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
            <h2 className="text-sm font-semibold text-slate-700 sm:text-base">
              {current?.label || 'Centring Materials'}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="hidden sm:inline">Centring Materials</span>
            <span className="hidden h-5 w-px bg-slate-200 sm:inline" />
            <span className="hidden items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 sm:flex">
              👤 {admin?.username || 'admin'}
            </span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              title="Sign out"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}