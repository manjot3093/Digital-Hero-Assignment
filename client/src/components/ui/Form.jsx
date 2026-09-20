import { forwardRef, useId } from 'react';

/**
 * Form primitives. Validation messages come from the API's `errors` array —
 * the same Zod schemas that guard the database — so what the user reads is
 * exactly what the server enforced.
 */
export function Field({ label, hint, error, required, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ivory-dim">
          {label}
          {required && <span className="ml-1 text-coral-400">*</span>}
        </span>
        {hint && <span className="text-xs text-ivory-faint">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-coral-400">{error}</span>}
    </label>
  );
}

const CONTROL =
  'w-full rounded-xl border bg-ink-800/80 px-3.5 py-2.5 text-sm text-ivory placeholder:text-mist-500 ' +
  'transition-colors focus:border-jade-500/70 focus:bg-ink-800 focus:outline-none disabled:opacity-60';

export const Input = forwardRef(function Input({ invalid, className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} ${invalid ? 'border-coral-500/60' : 'border-white/10'} ${className}`}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ invalid, className = '', rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} resize-y ${invalid ? 'border-coral-500/60' : 'border-white/10'} ${className}`}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ invalid, className = '', children, ...props }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} appearance-none bg-[length:0.7rem] bg-[right_1rem_center] bg-no-repeat pr-10 ${invalid ? 'border-coral-500/60' : 'border-white/10'} ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath fill='%238A94A0' d='M1 1l5 5 5-5'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
});

/**
 * Percentage slider used for the charity contribution. The minimum is a hard
 * 10% here and again in the API and again as a CHECK constraint in Postgres.
 */
export function PercentSlider({ value, onChange, min = 10, max = 100, step = 1, footnote, disabled }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-ivory-dim">
          Charity share of every payment
        </label>
        <span className="numeric font-display text-2xl font-semibold text-jade-400">{value}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-500 accent-jade-500 disabled:opacity-50"
      />
      <div className="mt-2 flex justify-between text-xs text-ivory-faint">
        <span>{min}% minimum</span>
        <span>{max}%</span>
      </div>
      {footnote && <p className="mt-3 text-sm text-ivory-faint">{footnote}</p>}
    </div>
  );
}

/** Top-of-form error summary for failures that are not tied to one field. */
export function FormError({ error }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-coral-500/35 bg-coral-950/60 px-4 py-3 text-sm text-coral-400"
    >
      {typeof error === 'string' ? error : error.message}
    </div>
  );
}

export default Field;
