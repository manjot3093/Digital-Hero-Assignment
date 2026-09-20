import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/**
 * Small, non-blocking feedback for actions: a saved score, a rejected proof, a
 * failed request. Errors stay on screen longer than confirmations.
 */
const ToastContext = createContext(null);

const TONE_STYLES = {
  success: 'border-jade-500/40 bg-jade-950/90 text-jade-400',
  error: 'border-coral-500/40 bg-coral-950/90 text-coral-400',
  info: 'border-white/15 bg-ink-700/95 text-ivory-dim',
  reward: 'border-gold-500/40 bg-gold-950/90 text-gold-400',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((message, { tone = 'info', duration } = {}) => {
    if (!message) return;
    counter.current += 1;
    const id = counter.current;
    const life = duration ?? (tone === 'error' ? 7000 : 4200);
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => dismiss(id), life);
  }, [dismiss]);

  const value = useMemo(() => ({
    push,
    success: (message) => push(message, { tone: 'success' }),
    error: (message) => push(message, { tone: 'error' }),
    info: (message) => push(message, { tone: 'info' }),
    reward: (message) => push(message, { tone: 'reward' }),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[80] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.button
              key={toast.id}
              type="button"
              onClick={() => dismiss(toast.id)}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={`pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 text-left text-sm backdrop-blur-panel ${TONE_STYLES[toast.tone]}`}
            >
              {toast.message}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider.');
  return context;
}

export default ToastContext;
