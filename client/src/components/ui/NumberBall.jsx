import { motion } from 'framer-motion';

/**
 * A drawn number. Matched balls are gold; the rest stay neutral so a member
 * can read their ticket against the result at a glance.
 */
export function NumberBall({ value, matched = false, size = 'md', index = 0, animate = false }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-lg',
  };

  const tone = matched
    ? 'border-gold-500/60 bg-gold-950 text-gold-400 shadow-[0_0_0_1px_rgba(201,162,39,0.25)]'
    : 'border-white/10 bg-ink-700 text-ivory-dim';

  const Component = animate ? motion.span : 'span';
  const motionProps = animate
    ? {
        initial: { opacity: 0, scale: 0.6, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: { delay: index * 0.09, duration: 0.42, ease: [0.22, 1, 0.36, 1] },
      }
    : {};

  return (
    <Component
      {...motionProps}
      className={`numeric inline-flex items-center justify-center rounded-full border font-display font-semibold ${sizes[size]} ${tone}`}
    >
      {String(value).padStart(2, '0')}
    </Component>
  );
}

export function NumberRow({ numbers = [], matches = [], size = 'md', animate = false }) {
  const matchSet = new Set(matches);
  return (
    <div className="flex flex-wrap gap-2">
      {numbers.map((value, index) => (
        <NumberBall
          key={`${value}-${index}`}
          value={value}
          index={index}
          size={size}
          animate={animate}
          matched={matchSet.has(value)}
        />
      ))}
    </div>
  );
}

export default NumberBall;
