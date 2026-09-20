import { Link } from 'react-router-dom';
import Brand from './Brand.jsx';

const COLUMNS = [
  {
    heading: 'Platform',
    links: [
      { to: '/how-it-works', label: 'How it works' },
      { to: '/pricing', label: 'Plans & allocation' },
      { to: '/draws', label: 'Draw results' },
    ],
  },
  {
    heading: 'Giving',
    links: [
      { to: '/charities', label: 'Charity directory' },
      { to: '/charities?featured=1', label: 'Featured causes' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { to: '/register', label: 'Create an account' },
      { to: '/login', label: 'Sign in' },
      { to: '/dashboard', label: 'Member dashboard' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/[0.07] bg-ink-800/60">
      <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Brand />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ivory-faint">
              A membership for golfers who want their round to count for something. Log your Stableford,
              fund a cause you choose, and enter the monthly member draw.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="eyebrow mb-4">{column.heading}</h2>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm text-ivory-faint transition-colors hover:text-ivory">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-mist-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Digital Heroes. Demonstration build — payments run in Stripe test mode.</p>
          <p className="font-mono uppercase tracking-[0.12em]">Play · Perform · Give back · Win</p>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
