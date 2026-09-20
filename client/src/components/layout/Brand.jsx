import { Link } from 'react-router-dom';

/**
 * Wordmark. The lowercase "digital." sits against a serif-weight "HEROES" so
 * the identity reads as an editorial masthead rather than a sports logo.
 */
export function Brand({ to = '/', className = '', compact = false }) {
  return (
    <Link to={to} className={`group inline-flex items-center gap-2.5 ${className}`} aria-label="Digital Heroes home">
      <span className="relative grid h-8 w-8 place-items-center rounded-lg border border-jade-500/40 bg-jade-950">
        <span className="block h-2 w-2 rounded-full bg-jade-400 transition-transform duration-300 group-hover:scale-125" />
        <span className="absolute bottom-1 h-px w-4 bg-gold-500" />
      </span>
      {!compact && (
        <span className="font-display text-[0.95rem] font-semibold tracking-tight text-ivory">
          digital<span className="text-jade-400">.</span>
          <span className="font-bold italic">HEROES</span>
        </span>
      )}
    </Link>
  );
}

export default Brand;
