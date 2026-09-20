import { EmptyState } from './Feedback.jsx';

/**
 * Admin table. On phones each row collapses into a stacked card with the
 * column name as a label, rather than forcing a horizontal scroll through a
 * shrunken desktop table.
 */
export function DataTable({ columns, rows, keyField = 'id', empty, onRowClick }) {
  if (!rows?.length) {
    return empty ?? <EmptyState title="Nothing here yet" description="There are no records to show." />;
  }

  return (
    <div className="overflow-hidden rounded-panel border border-white/[0.07] bg-ink-700/60">
      {/* Desktop */}
      <table className="hidden w-full border-collapse text-left text-sm md:table">
        <thead>
          <tr className="border-b border-white/[0.08]">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-ivory-faint ${column.align === 'right' ? 'text-right' : ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row[keyField]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-white/[0.05] last:border-0 transition-colors hover:bg-white/[0.03] ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-4 py-3.5 align-middle text-ivory-dim ${column.align === 'right' ? 'text-right' : ''}`}
                >
                  {column.render ? column.render(row) : row[column.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile */}
      <div className="divide-y divide-white/[0.06] md:hidden">
        {rows.map((row) => (
          <div
            key={row[keyField]}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className="space-y-2 px-4 py-4"
          >
            {columns.map((column) => (
              <div key={column.key} className="flex items-start justify-between gap-4">
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-ivory-faint">
                  {column.header}
                </span>
                <span className="text-right text-sm text-ivory-dim">
                  {column.render ? column.render(row) : row[column.key] ?? '—'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Pagination({ page, pageCount, total, onChange }) {
  if (!pageCount || pageCount <= 1) {
    return total ? <p className="mt-4 text-xs text-ivory-faint">{total} records</p> : null;
  }
  return (
    <div className="mt-5 flex items-center justify-between gap-4">
      <p className="text-xs text-ivory-faint">
        Page {page} of {pageCount} · {total} records
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded-lg border border-white/12 px-3 py-1.5 text-sm text-ivory-dim transition-colors hover:bg-white/[0.06] disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          className="rounded-lg border border-white/12 px-3 py-1.5 text-sm text-ivory-dim transition-colors hover:bg-white/[0.06] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default DataTable;
