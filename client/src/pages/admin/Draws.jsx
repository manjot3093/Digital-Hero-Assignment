import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { ApiError } from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { date, dateTime, money, number } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { GlassPanel, PageHeader, Eyebrow } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, LoadingPanel } from '../../components/ui/Feedback.jsx';
import { NumberRow } from '../../components/ui/NumberBall.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Field, FormError, Select } from '../../components/ui/Form.jsx';

/**
 * Draw index. Creating the next draw carries forward any unclaimed jackpot
 * from the last published draw — the server works that out, not this form.
 */
export default function AdminDraws() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get('/admin/draws'), []);
  const [creating, setCreating] = useState(false);

  if (loading) return <LoadingPanel rows={5} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const draws = data.draws ?? [];
  const live = draws.find((row) => row.status !== 'published');

  return (
    <>
      <PageHeader
        title="Draws"
        description="Create, configure, simulate and publish the monthly member draw."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            Create next draw
          </Button>
        }
      />

      {live && (
        <GlassPanel className="mb-8 p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-3">
                <Eyebrow>Active draw</Eyebrow>
                <Badge status={live.status}>{live.status}</Badge>
              </div>
              <p className="mt-4 font-display text-3xl font-semibold text-gold-400">
                {money(live.total_minor ?? 0, { compact: true })}
              </p>
              <p className="mt-2 text-sm text-ivory-faint">
                {live.reference} · {number(live.entry_count)} entries · drawn {dateTime(live.draw_at)}
                {Number(live.carried_in_minor) > 0 && <> · {money(live.carried_in_minor)} carried in</>}
              </p>
            </div>
            <Button to={`/admin/draws/${live.id}`}>Open draw controls</Button>
          </div>
        </GlassPanel>
      )}

      {draws.length === 0 ? (
        <EmptyState
          icon="◷"
          title="No draws yet"
          description="Create the first monthly draw. Entries are compiled from entitled members and their retained scores."
          action={<Button onClick={() => setCreating(true)}>Create a draw</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {draws.map((draw) => (
            <li key={draw.id}>
              <Link
                to={`/admin/draws/${draw.id}`}
                className="flex flex-wrap items-center gap-5 rounded-xl2 border border-white/[0.07] bg-ink-700/55 px-5 py-4 transition-colors hover:border-white/20"
              >
                <div className="min-w-[9rem]">
                  <p className="font-mono text-sm text-gold-400">{draw.reference}</p>
                  <p className="mt-1 text-xs text-mist-400">{date(draw.period_month)}</p>
                </div>

                <Badge status={draw.status}>{draw.status}</Badge>
                <Badge tone="neutral">{draw.strategy === 'weighted' ? 'weighted' : 'random'}</Badge>

                {draw.winning_numbers?.length ? (
                  <NumberRow numbers={draw.winning_numbers} size="sm" />
                ) : (
                  <span className="text-xs text-mist-500">Not drawn</span>
                )}

                <div className="ml-auto flex items-center gap-6 text-sm">
                  <span className="numeric text-ivory">{money(draw.total_minor ?? 0, { compact: true })}</span>
                  <span className="text-ivory-faint">{number(draw.entry_count)} entries</span>
                  <span className="text-ivory-faint">{number(draw.winner_count)} winners</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateDrawModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={async (message) => {
          setCreating(false);
          toast.success(message);
          await reload();
        }}
      />
    </>
  );
}

function CreateDrawModal({ open, onClose, onCreated }) {
  const [strategy, setStrategy] = useState('random');
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    setFields({});
    try {
      const result = await api.post('/admin/draws', { strategy });
      await onCreated(`${result.draw.reference} created and open for entries.`);
    } catch (cause) {
      setError(cause);
      if (cause instanceof ApiError) setFields(cause.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create the next draw"
      description="The period, reference and any carried-forward jackpot are derived on the server."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Create draw
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError error={error} />

        <Field
          label="Selection method"
          hint="Can be changed before publishing"
          error={fields.strategy}
        >
          <Select value={strategy} onChange={(event) => setStrategy(event.target.value)}>
            <option value="random">Random — every ball equally likely</option>
            <option value="weighted">Score-weighted — balls favoured by member scores</option>
          </Select>
        </Field>

        <p className="text-xs leading-relaxed text-mist-400">
          Both methods use a seeded generator, so a simulation and the published result produced from the
          same seed are identical. The weighted method keeps a baseline weight on every ball, so no number
          can become impossible.
        </p>
      </div>
    </Modal>
  );
}
