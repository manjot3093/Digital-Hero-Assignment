import { forwardRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * One button, four intents. Coral is the primary action across the product,
 * jade signals anything charity-related and gold anything prize-related, so
 * the variant is a meaning rather than a decoration.
 */
const VARIANTS = {
  primary:
    'bg-coral-500 text-ink-900 font-semibold hover:bg-coral-400 active:bg-coral-600 shadow-[0_14px_36px_-20px_rgba(232,102,60,0.9)]',
  jade:
    'bg-jade-500 text-ink-900 font-semibold hover:bg-jade-400 active:bg-jade-600 shadow-[0_14px_36px_-20px_rgba(47,163,122,0.9)]',
  gold:
    'bg-gold-500 text-ink-900 font-semibold hover:bg-gold-400 active:bg-gold-600',
  outline:
    'border border-white/15 bg-white/[0.03] text-ivory hover:border-white/30 hover:bg-white/[0.07]',
  ghost:
    'text-ivory-dim hover:bg-white/[0.06] hover:text-ivory',
  danger:
    'border border-coral-500/40 bg-coral-950/60 text-coral-400 hover:bg-coral-950',
};

const SIZES = {
  sm: 'h-9 px-3.5 text-sm rounded-xl',
  md: 'h-11 px-5 text-sm rounded-xl2',
  lg: 'h-13 px-7 text-base rounded-xl2 py-3.5',
};

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px select-none';

export const Button = forwardRef(function Button(
  { as, to, href, variant = 'primary', size = 'md', className = '', loading = false, disabled, children, ...props },
  ref
) {
  const classes = `${BASE} ${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.md} ${className}`;
  const content = (
    <>
      {loading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }

  const Component = as ?? 'button';
  return (
    <Component ref={ref} className={classes} disabled={disabled || loading} {...props}>
      {content}
    </Component>
  );
});

export default Button;
