import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button.jsx';

/**
 * Glass modal with the accessibility basics handled: focus moves into the
 * dialog, Escape closes it, and the page behind it stops scrolling.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink-900/80 backdrop-blur-sm"
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={`glass-panel relative w-full ${widths[size]} max-h-[88vh] overflow-y-auto p-6 focus:outline-none sm:p-7`}
          >
            <div className="mb-5 flex items-start justify-between gap-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-ivory">{title}</h2>
                {description && <p className="mt-1.5 text-sm text-ivory-faint">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-lg p-2 text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-ivory"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {children}
            {footer && <div className="mt-7 flex flex-wrap justify-end gap-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Confirmation for destructive or irreversible actions such as publishing. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'danger',
  loading = false,
  children,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

export default Modal;
