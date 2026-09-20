import { useState } from 'react';
import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { dateTime, money, titleCase } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { PageHeader, Eyebrow } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, LoadingPanel, Spinner } from '../../components/ui/Feedback.jsx';
import { DataTable, Pagination } from '../../components/ui/DataTable.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Field, FormError, Select, Textarea } from '../../components/ui/Form.jsx';

const STATES = [
  'PENDING_PROOF',
  'PROOF_SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PAYOUT_PENDING',
  'PAID',
  'REJECTED',
];

/**
 * Verification queue. The buttons shown for a row come from the winner's own
 * state — the server rejects any transition the state machine does not allow,
 * so an out-of-date tab cannot force a bad move.
 */
export default function AdminWinners() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [state, setState] = useState('');
  const [proofFor, setProofFor] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [payoutFor, setPayoutFor] = useState(null);
  const [busy, setBusy] = useState(null);

  const { data, loading, error, reload } = useAsync(
    () => api.get('/admin/winners', { query: { page, pageSize: 25, state: state || undefined } }),
    [page, state]
  );

  const act = async (winner, action) => {
    setBusy(winner.id + action);
    try {
      if (action === 'review') await api.post(`/admin/winners/${winner.id}/review`);
      if (action === 'approve') await api.post(`/admin/winners/${winner.id}/verify`, {});
      toast.success(action === 'review' ? 'Review started.' : 'Proof approved. The payout is now pending.');
      await reload();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Winners"
        description="Verify proof of score, approve claims and record payouts."
      />

      <div className="mb-5 max-w-xs">
        <Select
          value={state}
          onChange={(event) => {
            setPage(1);
            setState(event.target.value);
          }}
        >
          <option value="">All states</option>
          {STATES.map((item) => (
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
                icon="★"
                title="Nothing in the queue"
                description="Winners appear here as soon as a draw is published."
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
              {
                key: 'reference',
                header: 'Draw',
                render: (row) => <span className="font-mono text-xs text-gold-400">{row.reference}</span>,
              },
              {
                key: 'match_count',
                header: 'Tier',
                render: (row) => (
                  <Badge tone={row.match_count === 5 ? 'gold' : row.match_count === 4 ? 'coral' : 'jade'}>
                    {row.match_count} matched
                  </Badge>
                ),
              },
              {
                key: 'amount_minor',
                header: 'Amount',
                render: (row) => <span className="numeric text-ivory">{money(row.amount_minor)}</span>,
              },
              {
                key: 'state',
                header: 'State',
                render: (row) => <Badge status={row.state}>{String(row.state).replace(/_/g, ' ')}</Badge>,
              },
              {
                key: 'proof',
                header: 'Proof',
                render: (row) =>
                  row.proof_id ? (
                    <button
                      type="button"
                      onClick={() => setProofFor(row)}
                      className="text-xs text-jade-400 underline underline-offset-4"
                    >
                      View
                    </button>
                  ) : (
                    <span className="text-xs text-mist-500">None</span>
                  ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <div className="flex flex-wrap justify-end gap-1">
                    {row.state === 'PROOF_SUBMITTED' && (
                      <Button variant="ghost" size="sm" loading={busy === row.id + 'review'} onClick={() => act(row, 'review')}>
                        Start review
                      </Button>
                    )}
                    {row.state === 'UNDER_REVIEW' && (
                      <>
                        <Button variant="ghost" size="sm" loading={busy === row.id + 'approve'} onClick={() => act(row, 'approve')}>
                          Approve
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRejectFor(row)}>
                          Reject
                        </Button>
                      </>
                    )}
                    {(row.state === 'APPROVED' || row.state === 'PAYOUT_PENDING') && (
                      <Button variant="ghost" size="sm" onClick={() => setPayoutFor(row)}>
                        Mark paid
                      </Button>
                    )}
                    {row.state === 'PAID' && row.payout_reference && (
                      <span className="font-mono text-xs text-mist-400">{row.payout_reference}</span>
                    )}
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

      <ProofViewer winner={proofFor} onClose={() => setProofFor(null)} />

      <RejectModal
        winner={rejectFor}
        onClose={() => setRejectFor(null)}
        onDone={async () => {
          setRejectFor(null);
          toast.info('Proof rejected. The member can upload a replacement.');
          await reload();
        }}
      />

      <PayoutModal
        winner={payoutFor}
        onClose={() => setPayoutFor(null)}
        onDone={async () => {
          setPayoutFor(null);
          toast.success('Payout recorded.');
          await reload();
        }}
      />
    </>
  );
}

/**
 * The proof itself is never served from the database. The API returns a
 * short-lived signed URL to the object store, which is what this iframe loads.
 */
function ProofViewer({ winner, onClose }) {
  const { data, loading, error } = useAsync(
    () => (winner ? api.get(`/admin/winners/${winner.id}/proof`) : Promise.resolve(null)),
    [winner?.id]
  );

  return (
    <Modal
      open={Boolean(winner)}
      onClose={onClose}
      size="xl"
      title="Proof of score"
      description={winner ? `${winner.first_name} ${winner.last_name} · ${winner.reference}` : ''}
    >
      {loading && (
        <div className="grid h-72 place-items-center">
          <Spinner />
        </div>
      )}
      {error && <FormError error={error} />}
      {data?.url && (
        <>
          <div className="overflow-hidden rounded-xl2 border border-white/10 bg-ink-800">
            <iframe title="Winner proof" src={data.url} className="h-[60vh] w-full" />
          </div>
          <p className="mt-3 text-xs text-mist-400">
            {data.fileName} · uploaded {dateTime(data.uploadedAt)} · this link expires shortly.
          </p>
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block text-sm text-jade-400 underline underline-offset-4"
          >
            Open in a new tab
          </a>
        </>
      )}
    </Modal>
  );
}

function RejectModal({ winner, onClose, onDone }) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/admin/winners/${winner.id}/reject`, { notes });
      setNotes('');
      await onDone();
    } catch (cause) {
      setError(cause);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(winner)}
      onClose={onClose}
      title="Reject this proof"
      description="The member sees your note in their dashboard and can upload a replacement."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={saving} disabled={notes.trim().length < 5}>
            Reject proof
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError error={error} />
        <Field label="Reason" hint="Shown to the member" required>
          <Textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="The screenshot doesn't show the dates for the rounds in this entry."
          />
        </Field>
      </div>
    </Modal>
  );
}

function PayoutModal({ winner, onClose, onDone }) {
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = { method };
      if (reference) payload.reference = reference;
      await api.post(`/admin/winners/${winner.id}/payout`, payload);
      setReference('');
      await onDone();
    } catch (cause) {
      setError(cause);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(winner)}
      onClose={onClose}
      title="Record a payout"
      description={winner ? `${money(winner.amount_minor)} to ${winner.first_name} ${winner.last_name}.` : ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="jade" onClick={submit} loading={saving}>
            Mark as paid
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError error={error} />
        <Field label="Method">
          <Select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
            <option value="account_credit">Account credit</option>
          </Select>
        </Field>
        <Field label="Reference" hint="Optional — your own payment reference">
          <input
            className="w-full rounded-xl border border-white/10 bg-ink-800/80 px-3.5 py-2.5 text-sm text-ivory placeholder:text-mist-500 focus:border-jade-500/70 focus:outline-none"
            value={reference}
            maxLength={80}
            onChange={(event) => setReference(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
