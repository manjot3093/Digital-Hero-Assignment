import { useState } from 'react';
import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { date, money, titleCase } from '../../lib/format.js';
import { PageHeader } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, LoadingPanel } from '../../components/ui/Feedback.jsx';
import { DataTable, Pagination } from '../../components/ui/DataTable.jsx';
import { Select } from '../../components/ui/Form.jsx';

const STATUSES = ['active', 'past_due', 'cancelled', 'expired', 'trialing'];

/**
 * Subscriptions are read-only here on purpose. Their state is owned by the
 * payment provider and updated through signed webhooks — letting an operator
 * edit it by hand would put the two records out of step.
 */
export default function AdminSubscriptions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, loading, error, reload } = useAsync(
    () => api.get('/admin/subscriptions', { query: { page, pageSize: 25, status: status || undefined } }),
    [page, status]
  );

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Membership records as reported by the payment provider. Read-only by design."
      />

      <div className="mb-5 max-w-xs">
        <Select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {titleCase(item)}
            </option>
          ))}
        </Select>
      </div>

      {loading && <LoadingPanel rows={6} />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          <DataTable
            rows={data.items}
            empty={
              <EmptyState
                icon="▤"
                title="No subscriptions"
                description="Records appear here once a checkout completes and the webhook is received."
              />
            }
            columns={[
              {
                key: 'member',
                header: 'Member',
                render: (row) => (
                  <div>
                    <p className="text-ivory">
                      {row.first_name} {row.last_name}
                    </p>
                    <p className="text-xs text-mist-400">{row.email}</p>
                  </div>
                ),
              },
              { key: 'plan_name', header: 'Plan' },
              {
                key: 'amount_minor',
                header: 'Amount',
                render: (row) => (
                  <span className="numeric">
                    {money(row.amount_minor)}
                    <span className="ml-1 text-xs text-mist-400">/{row.interval === 'year' ? 'yr' : 'mo'}</span>
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge status={row.status}>{titleCase(row.status)}</Badge>
                    {row.cancel_at_period_end && <Badge tone="coral">Ending</Badge>}
                  </div>
                ),
              },
              { key: 'current_period_end', header: 'Period ends', render: (row) => date(row.current_period_end) },
              { key: 'created_at', header: 'Started', render: (row) => date(row.created_at) },
              {
                key: 'provider_subscription_id',
                header: 'Provider ref',
                render: (row) => (
                  <span className="font-mono text-xs text-mist-400">
                    {row.provider_subscription_id ? `${String(row.provider_subscription_id).slice(0, 18)}…` : '—'}
                  </span>
                ),
              },
            ]}
          />
          <Pagination
            page={data.pagination.page}
            pageCount={data.pagination.pageCount}
            total={data.pagination.total}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}
