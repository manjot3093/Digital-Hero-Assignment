import { motion, useReducedMotion } from 'framer-motion';

/**
 * Entrance animation for content that benefits from one — a hero line, a
 * result panel. Deliberately not applied to every section: it is opt-in, and
 * it respects the operating system's reduced-motion setting.
 */
export function Reveal({ children, delay = 0, y = 16, className = '', once = true }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Page transition wrapper — a short cross-fade, nothing theatrical. */
export function PageTransition({ children, className = '' }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
