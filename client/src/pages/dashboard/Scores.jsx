import { useState } from 'react';
import api, { ApiError } from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { date } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { PageHeader, Eyebrow } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, LoadingPanel } from '../../components/ui/Feedback.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Field, FormError, Input } from '../../components/ui/Form.jsx';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Score management.
 *
 * The five-score rule is not implemented here. The client shows what the rule
 * will do, but the eviction itself happens inside a database transaction on
 * the server — logging a sixth score from a script behaves identically.
 */
export default function DashboardScores() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get('/scores'), []);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingPanel rows={5} />;
  if (error) {
    // A lapsed member hits 403 here: the API gates score entry on entitlement.
    if (error.status === 403) {
      return (
        <>
          <PageHeader title="Scores" />
          <EmptyState
            icon="◷"
            title="Score entry needs an active membership"
            description="Your history is safe. Restart your plan and you can log rounds again straight away."
            action={<Button to="/dashboard/subscription">Review membership</Button>}
          />
        </>
      );
    }
    return <ErrorState error={error} onRetry={reload} />;
  }

  const { scores, retention, summary } = data;

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/scores/${removing.id}`);
      toast.success('Score removed.');
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
        title="Your Stableford scores"
        description="We keep your five most recent rounds. Log a sixth and the oldest drops off automatically."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            Log a score
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge tone={retention.remaining === 0 ? 'gold' : 'neutral'}>
          {retention.used} of {retention.max} retained
        </Badge>
        {summary.best != null && <Badge tone="jade">Best {summary.best}</Badge>}
        {summary.average != null && <Badge>Average {summary.average}</Badge>}
        {summary.trend != null && summary.trend !== 0 && (
          <Badge tone={summary.trend > 0 ? 'jade' : 'coral'}>
            {summary.trend > 0 ? '▲' : '▼'} {Math.abs(summary.trend)} vs earlier rounds
          </Badge>
        )}
      </div>

      {retention.remaining === 0 && (
        <p className="mb-6 rounded-xl2 border border-gold-500/25 bg-gold-950/40 px-5 py-3.5 text-sm text-gold-400">
          You are holding a full set. Your next score will replace the oldest round below.
        </p>
      )}

      {scores.length === 0 ? (
        <EmptyState
          icon="⛳"
          title="No rounds logged yet"
          description="Add the Stableford points from your most recent round. One entry per date, 1 to 45 points."
          action={<Button onClick={() => setAdding(true)}>Log your first score</Button>}
        />
      ) : (
        <ol className="space-y-3">
          {scores.map((score, index) => (
            <li
              key={score.id}
              className={`flex flex-wrap items-center gap-4 rounded-xl2 border px-5 py-4 ${
                index === scores.length - 1 && retention.remaining === 0
                  ? 'border-coral-500/25 bg-coral-950/20'
                  : 'border-white/[0.07] bg-ink-700/55'
              }`}
            >
              <span className="numeric grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-white/10 bg-ink-800 font-display text-xl font-semibold text-ivory">
                {score.value}
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-medium text-ivory">{date(score.playedOn)}</p>
                <p className="mt-0.5 truncate text-sm text-ivory-faint">{score.courseName ?? 'Course not recorded'}</p>
                {score.notes && <p className="mt-1 truncate text-xs text-mist-400">{score.notes}</p>}
              </div>

              {index === scores.length - 1 && retention.remaining === 0 && (
                <span className="text-xs text-coral-400">Next to drop off</span>
              )}

              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(score)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRemoving(score)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-8 text-xs leading-relaxed text-mist-400">
        Your retained scores map onto the 40-ball pool to build your draw ticket. Changing a score before
        entries close changes your numbers; once a draw is published, nothing about it can change.
      </p>

      <ScoreModal
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={async (message) => {
          setAdding(false);
          toast.success(message);
          await reload();
        }}
      />

      <ScoreModal
        open={Boolean(editing)}
        score={editing}
        onClose={() => setEditing(null)}
        onSaved={async (message) => {
          setEditing(null);
          toast.success(message);
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
            ? `${removing.value} points from ${date(removing.playedOn)}. This frees a slot in your retained five.`
            : ''
        }
        confirmLabel="Delete score"
      />
    </>
  );
}

function ScoreModal({ open, score, onClose, onSaved }) {
  const isEdit = Boolean(score);
  const [form, setForm] = useState({ value: '', playedOn: today(), courseName: '', notes: '' });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState(null);

  // Seed the form the first time a given score opens the dialog.
  if (open && isEdit && loadedFor !== score.id) {
    setLoadedFor(score.id);
    setForm({
      value: String(score.value),
      playedOn: String(score.playedOn).slice(0, 10),
      courseName: score.courseName ?? '',
      notes: score.notes ?? '',
    });
  }
  if (!open && loadedFor !== null) setLoadedFor(null);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event?.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = {
        value: Number(form.value),
        playedOn: form.playedOn,
        courseName: form.courseName || null,
        notes: form.notes || null,
      };
      if (isEdit) {
        await api.put(`/scores/${score.id}`, payload);
        await onSaved('Score updated.');
      } else {
        const result = await api.post('/scores', payload);
        await onSaved(
          result.evicted?.length
            ? 'Score saved. Your oldest round dropped off to keep the last five.'
            : 'Score saved.'
        );
        setForm({ value: '', playedOn: today(), courseName: '', notes: '' });
      }
    } catch (cause) {
      setError(cause);
      if (cause instanceof ApiError) setFieldErrors(cause.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit this score' : 'Log a Stableford score'}
      description={isEdit ? 'The same rules apply to an edit as to a new entry.' : 'One score per date, from 1 to 45 points.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {isEdit ? 'Save changes' : 'Save score'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <FormError error={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stableford points" hint="1–45" error={fieldErrors.value} required>
            <Input
              type="number"
              min="1"
              max="45"
              step="1"
              inputMode="numeric"
              required
              value={form.value}
              onChange={set('value')}
              invalid={Boolean(fieldErrors.value)}
              autoFocus
            />
          </Field>
          <Field label="Date played" error={fieldErrors.playedOn} required>
            <Input
              type="date"
              required
              max={today()}
              value={form.playedOn}
              onChange={set('playedOn')}
              invalid={Boolean(fieldErrors.playedOn)}
            />
          </Field>
        </div>

        <Field label="Course" hint="Optional" error={fieldErrors.courseName}>
          <Input value={form.courseName} onChange={set('courseName')} placeholder="Royal Dornoch" maxLength={120} />
        </Field>

        <Field label="Notes" hint="Optional" error={fieldErrors.notes}>
          <Input value={form.notes} onChange={set('notes')} maxLength={400} placeholder="Windy back nine" />
        </Field>

        <Eyebrow>Only one score can be recorded per date</Eyebrow>
      </form>
    </Modal>
  );
}
