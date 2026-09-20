/**
 * Surfaces. `GlassPanel` is reserved for floating things — navigation, key
 * metrics, modals, the prize pool. `SolidPanel` carries dense content so the
 * interface keeps a readable hierarchy instead of dissolving into blur.
 */
export function GlassPanel({ as: Component = 'div', className = '', children, ...props }) {
  return (
    <Component className={`glass-panel ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function SolidPanel({ as: Component = 'div', className = '', children, ...props }) {
  return (
    <Component className={`solid-panel ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function Eyebrow({ children, className = '' }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

/** Section heading used across public pages and dashboards. */
export function SectionHeading({ eyebrow, title, lead, actions, align = 'left', className = '' }) {
  return (
    <div
      className={`flex flex-col gap-4 ${align === 'center' ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between'} ${className}`}
    >
      <div className={align === 'center' ? 'max-w-2xl' : 'max-w-2xl'}>
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h2 className="text-headline text-ivory">{title}</h2>
        {lead && <p className="mt-3 text-base leading-relaxed text-ivory-faint">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

/** Page-level header inside the dashboard and admin shells. */
export function PageHeader({ title, description, actions }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-title font-semibold text-ivory">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm text-ivory-faint">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export default GlassPanel;
