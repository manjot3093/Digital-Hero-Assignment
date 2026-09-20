import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext.jsx';
import Button from '../ui/Button.jsx';
import Brand from './Brand.jsx';

const LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/charities', label: 'Charities' },
  { to: '/draws', label: 'Draws' },
  { to: '/pricing', label: 'Pricing' },
];

/**
 * Translucent navigation that gains a border and a stronger blur once the page
 * scrolls, so it reads as a layer above the content rather than a floating bar
 * with nothing behind it.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { isAuthenticated, isAdmin, user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'border-b border-white/[0.08] bg-ink-900/75 backdrop-blur-panel' : 'border-b border-transparent'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Brand />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? 'text-ivory' : 'text-ivory-faint hover:text-ivory'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Button to="/admin" variant="ghost" size="sm">
                  Admin
                </Button>
              )}
              <Button to="/dashboard" variant="outline" size="sm">
                {user?.firstName ? `${user.firstName}'s dashboard` : 'Dashboard'}
              </Button>
            </>
          ) : (
            <>
              <Button to="/login" variant="ghost" size="sm">
                Sign in
              </Button>
              <Button to="/register" size="sm">
                Join Digital Heroes
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Toggle navigation"
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 md:hidden"
        >
          <span className="relative block h-3 w-4">
            <span
              className={`absolute left-0 block h-px w-4 bg-ivory transition-transform duration-300 ${open ? 'top-1.5 rotate-45' : 'top-0'}`}
            />
            <span
              className={`absolute left-0 top-1.5 block h-px w-4 bg-ivory transition-opacity duration-200 ${open ? 'opacity-0' : ''}`}
            />
            <span
              className={`absolute left-0 block h-px w-4 bg-ivory transition-transform duration-300 ${open ? 'top-1.5 -rotate-45' : 'top-3'}`}
            />
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/[0.08] bg-ink-900/95 backdrop-blur-panel md:hidden"
          >
            <nav className="flex flex-col gap-1 px-5 py-4" aria-label="Mobile">
              {LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-xl px-3 py-3 text-sm text-ivory-dim transition-colors hover:bg-white/[0.05]"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 grid gap-2.5">
                {isAuthenticated ? (
                  <>
                    <Button to="/dashboard" variant="outline">
                      Dashboard
                    </Button>
                    {isAdmin && (
                      <Button to="/admin" variant="ghost">
                        Admin console
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button to="/register">Join Digital Heroes</Button>
                    <Button to="/login" variant="outline">
                      Sign in
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default SiteHeader;
