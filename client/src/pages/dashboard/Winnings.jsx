import { useRef, useState } from 'react';
import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { date, dateTime, money, number } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { GlassPanel, PageHeader, Eyebrow } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, LoadingPanel } from '../../components/ui/Feedback.jsx';
import { MiniStat } from '../../components/ui/Stat.jsx';
import { NumberRow } from '../../components/ui/NumberBall.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { FormError } from '../../components/ui/Form.jsx';

/**
 * A win moves through a fixed sequence of states, and the server decides every
 * transition. This screen only ever offers the actions the API says are
 * available for the current state (`winner.actions`).
 */
const STATE_COPY = {
  PENDING_PROOF: {
    tone: 'coral',
    heading: 'Upload your proof',
    body: 'Attach a screenshot of your scores from your golf platform so an administrator can verify the win.',
  },
  PROOF_SUBMITTED: {
    tone: 'gold',
    heading: 'Proof received',
    body: 'Your screenshot is in the queue. An administrator will pick it up shortly.',
  },
  UNDER_REVIEW: {
    tone: 'gold',
    heading: 'Under review',
    body: 'An administrator is checking your proof right now.',
  },
  APPROVED: {
    tone: 'jade',
    heading: 'Approved',
    body: 'Your proof was accepted. The payout is being prepared.',
  },
  PAYOUT_PENDING: {
    tone: 'jade',
    heading: 'Payout pending',
    body: 'Approved and queued for payment.',
  },
  PAID: {
    tone: 'jade',
    heading: 'Paid',
    body: 'This win has been paid out in full.',
  },
  REJECTED: {
    tone: 'coral',
    heading: 'Proof rejected',
    body: 'The screenshot could not be verified. You can upload a new one.',
  },
};

export default function DashboardWinnings() {
  const { data, loading, error, reload } = useAsync(() => api.get('/winners/me'), []);
  const [uploadFor, setUploadFor] = useState(null);

  if (loading) return <LoadingPanel rows={4} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { winnings, summary } = data;

  return (
    <>
      <PageHeader
        title="Winnings"
        description="Every win you've had, and what still needs doing to get it paid."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Total won" value={money(summary.totalWonMinor, { compact: true })} tone="gold" />
        <MiniStat label="Paid" value={money(summary.paidMinor, { compact: true })} tone="jade" />
        <MiniStat
          label="Awaiting proof"
          value={number(summary.awaitingProof)}
          tone={summary.awaitingProof > 0 ? 'coral' : 'ivory'}
        />
        <MiniStat label="Wins" value={number(summary.winCount)} />
      </div>

      {winnings.length === 0 ? (
        <EmptyState
          icon="★"
          title="No wins yet"
          description="Match three or more numbers in a monthly draw and the claim will appear here."
          action={<Button to="/draws" variant="outline">See past draws</Button>}
        />
      ) : (
        <ul className="space-y-4">
          {winnings.map((winner) => {
            const copy = STATE_COPY[winner.state] ?? STATE_COPY.PENDING_PROOF;
            const canUpload = (winner.actions ?? []).includes('SUBMIT_PROOF');

            return (
              <li key={winner.id}>
                <GlassPanel className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-sm text-gold-400">{winner.reference}</span>
                        <Badge status={winner.state}>{String(winner.state).replace(/_/g, ' ')}</Badge>
                        <span className="text-xs text-ivory-faint">{date(winner.draw_at)}</span>
                      </div>
                      <p className="mt-4 font-display text-3xl font-semibold text-ivory">
                        {money(winner.amount_minor)}
                      </p>
                      <p className="mt-1.5 text-sm text-ivory-faint">
                        {winner.match_count} numbers matched
                      </p>
                    </div>

                    <div>
                      <Eyebrow className="mb-3">Winning numbers</Eyebrow>
                      <NumberRow numbers={winner.winning_numbers ?? []} size="sm" />
                    </div>
                  </div>

                  <div
                    className={`mt-6 rounded-xl2 border px-5 py-4 ${
                      copy.tone === 'coral'
                        ? 'border-coral-500/30 bg-coral-950/40'
                        : copy.tone === 'gold'
                          ? 'border-gold-500/25 bg-gold-950/40'
                          : 'border-jade-500/25 bg-jade-950/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="font-display text-sm font-medium text-ivory">{copy.heading}</p>
                        <p className="mt-1 max-w-xl text-sm text-ivory-faint">{copy.body}</p>
                        {winner.review_notes && (
                          <p className="mt-2 text-sm text-coral-400">Reviewer note: {winner.review_notes}</p>
                        )}
                        {winner.file_name && (
                          <p className="mt-2 text-xs text-mist-400">
                            {winner.file_name} · uploaded {dateTime(winner.proof_uploaded_at)}
                          </p>
                        )}
                        {winner.processed_at && (
                          <p className="mt-2 text-xs text-jade-400">Paid {dateTime(winner.processed_at)}</p>
                        )}
                      </div>

                      {canUpload && (
                        <Button size="sm" onClick={() => setUploadFor(winner)}>
                          {winner.state === 'REJECTED' ? 'Upload new proof' : 'Upload proof'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progress rail */}
                  <ol className="mt-6 flex flex-wrap gap-1.5">
                    {['PENDING_PROOF', 'PROOF_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PAYOUT_PENDING', 'PAID'].map(
                      (state) => {
                        const order = ['PENDING_PROOF', 'PROOF_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PAYOUT_PENDING', 'PAID'];
                        const reached = winner.state !== 'REJECTED' && order.indexOf(state) <= order.indexOf(winner.state);
                        return (
                          <li
                            key={state}
                            className={`flex-1 rounded-full py-1 text-center font-mono text-[0.58rem] uppercase tracking-[0.1em] ${
                              reached ? 'bg-jade-500/25 text-jade-400' : 'bg-white/[0.04] text-mist-500'
                            }`}
                          >
                            {state.replace(/_/g, ' ')}
                          </li>
                        );
                      }
                    )}
                  </ol>
                </GlassPanel>
              </li>
            );
          })}
        </ul>
      )}

      <ProofModal
        winner={uploadFor}
        onClose={() => setUploadFor(null)}
        onUploaded={async () => {
          setUploadFor(null);
          await reload();
        }}
      />
    </>
  );
}

function ProofModal({ winner, onClose, onUploaded }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const submit = async () => {
    if (!file) {
      setError(new Error('Choose a file first.'));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('proof', file);
      await api.upload(`/winners/${winner.id}/proof`, form);
      toast.success('Proof uploaded. An administrator will review it shortly.');
      setFile(null);
      await onUploaded();
    } catch (cause) {
      setError(cause);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={Boolean(winner)}
      onClose={onClose}
      title="Upload your proof"
      description="A screenshot of your scores from your golf platform, showing the rounds behind this entry."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={submit} loading={uploading} disabled={!file}>
            Upload proof
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError error={error} />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center rounded-panel border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center transition-colors hover:border-jade-500/40"
        >
          <span aria-hidden="true" className="mb-3 font-display text-2xl text-mist-500">
            ⬆
          </span>
          <span className="text-sm text-ivory">{file ? file.name : 'Choose a screenshot'}</span>
          <span className="mt-1.5 text-xs text-mist-400">PNG, JPEG, WebP or PDF · up to 5MB</span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="sr-only"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError(null);
          }}
        />

        <p className="text-xs leading-relaxed text-mist-400">
          Files are stored in object storage, not in the database. The reviewer opens them through a
          short-lived signed link.
        </p>
      </div>
    </Modal>
  );
}
