import { useState } from 'react';
import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { date, money, titleCase } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { PageHeader } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, LoadingPanel } from '../../components/ui/Feedback.jsx';
import { DataTable, Pagination } from '../../components/ui/DataTable.jsx';
import { Input, Select } from '../../components/ui/Form.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';

/** Account administration: search, filter, and suspend or reinstate a member. */
export default function AdminUsers() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () =>
      api.get('/admin/users', {
        query: { page, pageSize: 25, search, role: role || undefined, status: status || undefined },
      }),
    [page, search, role, status]
  );

  const changeStatus = async () => {
    setBusy(true);
    try {
      const next = target.status === 'suspended' ? 'active' : 'suspended';
      await api.patch(`/admin/users/${target.id}/status`, { status: next });
      toast.success(next === 'suspended' ? 'Account suspended.' : 'Account reinstated.');
      setTarget(null);
      await reload();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Every account on the platform, with its role, membership state and chosen cause."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Input
          type="search"
          placeholder="Search by name or email"
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
        <Select
          value={role}
          onChange={(event) => {
            setPage(1);
            setRole(event.target.value);
          }}
        >
          <option value="">All roles</option>
          <option value="subscriber">Subscribers</option>
          <option value="admin">Administrators</option>
        </Select>
        <Select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
      </div>

      {loading && <LoadingPanel rows={6} />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          <DataTable
            rows={data.items}
            empty={<EmptyState icon="⌕" title="No accounts match" description="Adjust the filters above." />}
            columns={[
              {
                key: 'name',
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
              {
                key: 'role',
                header: 'Role',
                render: (row) => <Badge tone={row.role === 'admin' ? 'coral' : 'neutral'}>{row.role}</Badge>,
              },
              {
                key: 'status',
                header: 'Account',
                render: (row) => <Badge status={row.status}>{row.status}</Badge>,
              },
              {
                key: 'subscription_status',
                header: 'Membership',
                render: (row) =>
                  row.subscription_status ? (
                    <Badge status={row.subscription_status}>{titleCase(row.subscription_status)}</Badge>
                  ) : (
                    <span className="text-xs text-mist-500">None</span>
                  ),
              },
              {
                key: 'charity_name',
                header: 'Cause',
                render: (row) =>
                  row.charity_name ? (
                    <span className="text-xs text-jade-400">
                      {row.charity_name} · {row.charity_percent}%
                    </span>
                  ) : (
                    <span className="text-xs text-mist-500">Not chosen</span>
                  ),
              },
              { key: 'created_at', header: 'Joined', render: (row) => date(row.created_at) },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <Button variant="ghost" size="sm" onClick={() => setTarget(row)}>
                    {row.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                  </Button>
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

      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={changeStatus}
        loading={busy}
        variant={target?.status === 'suspended' ? 'jade' : 'danger'}
        title={target?.status === 'suspended' ? 'Reinstate this account?' : 'Suspend this account?'}
        description={
          target
            ? target.status === 'suspended'
              ? `${target.first_name} ${target.last_name} will be able to sign in again.`
              : `${target.first_name} ${target.last_name} will be signed out of new requests and lose draw entitlement. Their history is kept.`
            : ''
        }
        confirmLabel={target?.status === 'suspended' ? 'Reinstate' : 'Suspend'}
      />
    </>
  );
}
