import { useState } from 'react';
import api, { ApiError } from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { date } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { PageHeader } from '../../components/ui/Panel.jsx';
import { EmptyState, ErrorState, LoadingPanel } from '../../components/ui/Feedback.jsx';
import { DataTable, Pagination } from '../../components/ui/DataTable.jsx';
import { Field, FormError, Input } from '../../components/ui/Form.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';

/**
 * Score moderation. Corrections go through the same service a member uses, so
 * the rolling-five rule and the one-per-date constraint still apply, and the
 * edit is written to the audit log.
 */
export default function AdminScores() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => api.get('/admin/scores', { query: { page, pageSize: 25, search } }),
    [page, search]
  );

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/admin/scores/${removing.id}`);
      toast.success('Score deleted.');
      setRemoving(null);
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
        title="Scores"
        description="All retained Stableford scores. Corrections are audited and obey the same rules as member entry."
      />

      <div className="mb-5 max-w-sm">
        <Input
          type="search"
          placeholder="Filter by member email"
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
      </div>

      {loading && <LoadingPanel rows={6} />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          <DataTable
            rows={data.items}
            empty={<EmptyState icon="⛳" title="No scores recorded" description="Members' rounds will appear here." />}
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
              {
                key: 'value',
                header: 'Points',
                render: (row) => <span className="numeric font-display text-base text-ivory">{row.value}</span>,
              },
              { key: 'played_on', header: 'Played', render: (row) => date(row.played_on) },
              { key: 'course_name', header: 'Course', render: (row) => row.course_name ?? '—' },
              { key: 'created_at', header: 'Logged', render: (row) => date(row.created_at) },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(row)}>
                      Delete
                    </Button>
                  </div>
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

      <EditScoreModal
        score={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          toast.success('Score updated.');
          await reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        loading={busy}
        title="Delete this score?"
        description={
          removing
            ? `${removing.value} points from ${date(removing.played_on)}, logged by ${removing.email}. The deletion is recorded in the audit log.`
            : ''
        }
        confirmLabel="Delete score"
      />
    </>
  );
}

function EditScoreModal({ score, onClose, onSaved }) {
  const [form, setForm] = useState({ value: '', playedOn: '' });
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState(null);

  if (score && loadedFor !== score.id) {
    setLoadedFor(score.id);
    setForm({ value: String(score.value), playedOn: String(score.played_on).slice(0, 10) });
  }
  if (!score && loadedFor !== null) setLoadedFor(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    setFields({});
    try {
      await api.put(`/admin/scores/${score.id}`, {
        value: Number(form.value),
        playedOn: form.playedOn,
      });
      await onSaved();
    } catch (cause) {
      setError(cause);
      if (cause instanceof ApiError) setFields(cause.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(score)}
      onClose={onClose}
      title="Correct a score"
      description="This uses the member score service, so the five-score rule and the one-per-date constraint still apply."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Save correction
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError error={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stableford points" hint="1–45" error={fields.value}>
            <Input
              type="number"
              min="1"
              max="45"
              value={form.value}
              onChange={(event) => setForm((c) => ({ ...c, value: event.target.value }))}
              invalid={Boolean(fields.value)}
            />
          </Field>
          <Field label="Date played" error={fields.playedOn}>
            <Input
              type="date"
              value={form.playedOn}
              onChange={(event) => setForm((c) => ({ ...c, playedOn: event.target.value }))}
              invalid={Boolean(fields.playedOn)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
