import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';
import { money, number } from '../../lib/format.js';

/**
 * Counts a figure up once when it first appears. Used sparingly — the prize
 * pool, charity totals and the admin headline metrics — so the movement still
 * means "this number matters" rather than being background noise.
 */
export function AnimatedNumber({ value, format = 'number', currency = 'GBP', className = '' }) {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(() =>
    format === 'money' ? money(0, { currency, compact: true }) : number(0)
  );

  const rounded = useTransform(motionValue, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(motionValue, Number(value ?? 0), {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
    });
    const unsubscribe = rounded.on('change', (latest) => {
      setDisplay(format === 'money' ? money(latest, { currency, compact: true }) : number(latest));
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, format, currency, motionValue, rounded]);

  return <span className={`numeric ${className}`}>{display}</span>;
}

const ACCENTS = {
  jade: 'text-jade-400',
  gold: 'text-gold-400',
  coral: 'text-coral-400',
  ivory: 'text-ivory',
};

/** Headline metric tile. Glass because these float above the page content. */
export function Stat({ label, value, sublabel, accent = 'ivory', animated = false, format, currency, className = '' }) {
  return (
    <div className={`glass-panel px-5 py-5 ${className}`}>
      <p className="eyebrow">{label}</p>
      <p className={`mt-3 font-display text-3xl font-semibold tracking-tight ${ACCENTS[accent]}`}>
        {animated ? <AnimatedNumber value={value} format={format} currency={currency} /> : value}
      </p>
      {sublabel && <p className="mt-1.5 text-sm text-ivory-faint">{sublabel}</p>}
    </div>
  );
}

/** Compact variant for dense admin grids. */
export function MiniStat({ label, value, tone = 'ivory', hint }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl2 border border-white/[0.07] bg-ink-700/70 px-4 py-4"
    >
      <p className="text-xs uppercase tracking-[0.1em] text-ivory-faint">{label}</p>
      <p className={`numeric mt-2 font-display text-2xl font-semibold ${ACCENTS[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-mist-400">{hint}</p>}
    </motion.div>
  );
}

export default Stat;
