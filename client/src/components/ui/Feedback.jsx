import { motion } from 'framer-motion';

/** Status pill. Tone is derived from the domain value, not passed ad hoc. */
const TONES = {
  neutral: 'border-white/12 bg-white/[0.05] text-ivory-faint',
  jade: 'border-jade-500/35 bg-jade-950/70 text-jade-400',
  gold: 'border-gold-500/35 bg-gold-950/70 text-gold-400',
  coral: 'border-coral-500/35 bg-coral-950/70 text-coral-400',
  mist: 'border-mist-600/60 bg-ink-600/70 text-mist-400',
};

const STATUS_TONE = {
  active: 'jade', trialing: 'jade', approved: 'jade', paid: 'jade', published: 'jade', succeeded: 'jade',
  past_due: 'coral', expired: 'coral', cancelled: 'coral', canceled: 'coral', rejected: 'coral',
  failed: 'coral', suspended: 'coral', REJECTED: 'coral',
  pending: 'gold', PENDING_PROOF: 'gold', PROOF_SUBMITTED: 'gold', UNDER_REVIEW: 'gold',
  PAYOUT_PENDING: 'gold', simulated: 'gold', locked: 'gold',
  APPROVED: 'jade', PAID: 'jade',
  open: 'neutral', scheduled: 'neutral', draft: 'mist',
};

export function Badge({ children, tone, status, className = '' }) {
  const resolved = tone ?? STATUS_TONE[status] ?? 'neutral';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] ${TONES[resolved]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = '' }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-jade-400 ${className}`}
    />
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`shimmer rounded-xl ${className}`} aria-hidden="true" />;
}

export function LoadingPanel({ rows = 3, className = '' }) {
  return (
    <div className={`solid-panel space-y-3 p-6 ${className}`}>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

/**
 * Empty states are a first-class screen here, not an afterthought: each one
 * explains what would normally be here and offers the action that fills it.
 */
export function EmptyState({ icon = '◇', title, description, action, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center rounded-panel border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center ${className}`}
    >
      <span aria-hidden="true" className="mb-4 font-display text-3xl text-mist-500">
        {icon}
      </span>
      <h3 className="font-display text-lg font-semibold text-ivory">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-ivory-faint">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}

/** Shown when a loader throws. Always offers a way back rather than a dead end. */
export function ErrorState({ error, onRetry, className = '' }) {
  return (
    <div
      role="alert"
      className={`rounded-panel border border-coral-500/30 bg-coral-950/40 px-6 py-10 text-center ${className}`}
    >
      <h3 className="font-display text-lg font-semibold text-ivory">That didn&apos;t load</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-coral-400">
        {error?.message ?? 'Something went wrong on our side.'}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-xl border border-white/15 px-4 py-2 text-sm text-ivory transition-colors hover:bg-white/[0.06]"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export default Badge;
