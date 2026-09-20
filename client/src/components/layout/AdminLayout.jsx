import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import Brand from './Brand.jsx';

const NAV = [
  { to: '/admin', label: 'Console', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/subscriptions', label: 'Subscriptions' },
  { to: '/admin/scores', label: 'Scores' },
  { to: '/admin/draws', label: 'Draws' },
  { to: '/admin/charities', label: 'Charities' },
  { to: '/admin/winners', label: 'Winners' },
  { to: '/admin/reports', label: 'Reports' },
];

/**
 * The admin experience is a separate shell, not the member dashboard with more
 * links: denser type, a lighter chrome, and a horizontal section bar that
 * scrolls on narrow screens.
 */
export function AdminLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [elevated, setElevated] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-ink-900">
      <header
        className={`sticky top-0 z-40 border-b transition-colors ${
          elevated ? 'border-white/[0.09] bg-ink-800/90 backdrop-blur-panel' : 'border-white/[0.05] bg-ink-800/60'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Brand to="/admin" />
            <span className="hidden rounded-md border border-coral-500/35 bg-coral-950/60 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-coral-400 sm:inline">
              Operator console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-ivory-faint sm:inline">{user?.email}</span>
            <NavLink to="/dashboard" className="text-xs text-ivory-faint transition-colors hover:text-ivory">
              Member view
            </NavLink>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-ivory-faint transition-colors hover:bg-white/[0.05] hover:text-ivory"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav aria-label="Admin sections" className="mx-auto w-full max-w-[1400px] px-4 sm:px-6">
          <ul className="-mx-1 flex gap-1 overflow-x-auto pb-2">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      isActive ? 'bg-white/[0.08] text-ivory' : 'text-ivory-faint hover:text-ivory'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
