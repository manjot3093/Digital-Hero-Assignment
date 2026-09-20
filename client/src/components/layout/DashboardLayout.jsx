import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { initials } from '../../lib/format.js';
import { Badge } from '../ui/Feedback.jsx';
import Brand from './Brand.jsx';
import Button from '../ui/Button.jsx';

const NAV = [
  { to: '/dashboard', label: 'Overview', end: true, glyph: '◈' },
  { to: '/dashboard/scores', label: 'Scores', glyph: '⛳' },
  { to: '/dashboard/charity', label: 'Charity', glyph: '♥' },
  { to: '/dashboard/winnings', label: 'Winnings', glyph: '★' },
  { to: '/dashboard/subscription', label: 'Membership', glyph: '◷' },
  { to: '/dashboard/profile', label: 'Profile', glyph: '⌂' },
];

/**
 * Member shell. A quiet left rail on desktop; on phones the same destinations
 * become a bottom bar with touch-sized targets, which is where a thumb
 * actually is — not a shrunken sidebar.
 */
export function DashboardLayout() {
  const { user, subscription, logout } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const status = subscription?.status ?? 'none';

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-white/[0.07] bg-ink-800/70 px-4 py-6 backdrop-blur-panel lg:flex">
        <Brand className="mb-8 px-2" />

        <nav className="flex-1 space-y-1" aria-label="Dashboard">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/[0.07] text-ivory'
                    : 'text-ivory-faint hover:bg-white/[0.04] hover:text-ivory-dim'
                }`
              }
            >
              <span aria-hidden="true" className="w-4 text-center text-xs text-mist-400">
                {item.glyph}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 rounded-xl2 border border-white/[0.07] bg-ink-700/70 p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-jade-950 font-display text-xs font-semibold text-jade-400">
              {initials(user?.firstName, user?.lastName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm text-ivory">{user?.firstName} {user?.lastName}</p>
              <Badge status={status} className="mt-1">{status.replace('_', ' ')}</Badge>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-lg border border-white/10 py-1.5 text-xs text-ivory-faint transition-colors hover:bg-white/[0.05] hover:text-ivory"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        {/* Mobile top bar */}
        <header
          className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.08] bg-ink-900/85 px-4 backdrop-blur-panel lg:hidden"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <Brand compact />
          <div className="flex items-center gap-2">
            <Badge status={status}>{status.replace('_', ' ')}</Badge>
            <Button variant="ghost" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav
          aria-label="Dashboard sections"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-ink-900/92 backdrop-blur-panel lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <ul className="grid grid-cols-5">
            {NAV.slice(0, 5).map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-[3.6rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.66rem] transition-colors ${
                      isActive ? 'text-jade-400' : 'text-mist-400'
                    }`
                  }
                >
                  <span aria-hidden="true" className="text-sm">{item.glyph}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export default DashboardLayout;
