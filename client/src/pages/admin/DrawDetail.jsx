import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { date, dateTime, money, number } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { GlassPanel, PageHeader, Eyebrow } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, LoadingPanel } from '../../components/ui/Feedback.jsx';
import { NumberRow } from '../../components/ui/NumberBall.jsx';
import { MiniStat } from '../../components/ui/Stat.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Field, FormError, Input, Select } from '../../components/ui/Form.jsx';

/**
 * Draw controls.
 *
 * The split between simulation and publication is the point of this screen. A
 * simulation writes only to draw_simulations and can be run as often as you
 * like; publishing runs once, inside a single transaction, and is final. The
 * publish form carries the seed from the simulation being reviewed, so what is
 * committed is exactly the outcome the operator just looked at.
 */
export default function AdminDrawDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get(`/admin/draws/${id}`), [id]);

  const [simulating, setSimulating] = useState(false);
  const [latest, setLatest] = useState(null);
  const [publishFor, setPublishFor] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (loading) return <LoadingPanel rows={6} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { draw, tiers, pool, entryCount, winners, simulations } = data;
  const published = draw.status === 'published';
  const review = latest ?? simulations?.[0]?.result ?? null;
  const reviewSeed = latest?.seed ?? simulations?.[0]?.seed ?? null;

  const refreshEntries = async () => {
    setRefreshing(true);
    try {
      const result = await api.post(`/admin/draws/${id}/entries`);
      toast.success(`Entries rebuilt — ${number(result.entryCount)} in the field.`);
      await reload();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setRefreshing(false);
    }
  };

  const simulate = async (options) => {
    setSimulating(true);
    try {
      const result = await api.post(`/admin/draws/${id}/simulate`, options);
      setLatest({ ...result.simulation.result, seed: result.simulation.result.seed });
      toast.info('Simulation complete. Nothing has been committed.');
      await reload();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSimulating(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const result = await api.post(`/admin/draws/${id}/publish`, {
        confirm: true,
        seed: publishFor.seed,
        strategy: publishFor.strategy,
      });
      toast.reward(`${result.draw.reference} published.`);
      setPublishFor(null);
      setLatest(null);
      await reload();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <Link to="/admin/draws" className="mb-4 inline-block text-sm text-ivory-faint hover:text-ivory">
        ← All draws
      </Link>

      <PageHeader
        title={draw.reference}
        description={`Period ${date(draw.period_month)} · drawn ${dateTime(draw.draw_at)}`}
        actions={
          <>
            <Badge status={draw.status}>{draw.status}</Badge>
            <Badge tone="neutral">{draw.strategy === 'weighted' ? 'weighted' : 'random'}</Badge>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Prize pool" value={money(pool?.total_minor ?? draw.total_minor ?? 0, { compact: true })} tone="gold" />
        <MiniStat label="Carried in" value={money(draw.carried_in_minor ?? 0, { compact: true })} />
        <MiniStat label="Entries" value={number(entryCount)} />
        <MiniStat label="Winners" value={number(winners?.length ?? 0)} tone="jade" />
      </div>

      {/* Controls */}
      {!published ? (
        <GlassPanel className="mb-6 p-6">
          <Eyebrow>Controls</Eyebrow>
          <p className="mt-2 max-w-2xl text-sm text-ivory-faint">
            Rebuild the field from current members, then simulate as many times as you need. Publishing is
            a separate, irreversible step.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" onClick={refreshEntries} loading={refreshing}>
              Rebuild entries
            </Button>
            <Button variant="outline" onClick={() => setConfiguring(true)}>
              Configure
            </Button>
            <Button onClick={() => simulate({})} loading={simulating}>
              Run simulation
            </Button>
            {review && (
              <Button
                variant="gold"
                onClick={() => setPublishFor({ seed: reviewSeed, strategy: review.strategy })}
              >
                Publish this result
              </Button>
            )}
          </div>
        </GlassPanel>
      ) : (
        <div className="mb-6 rounded-xl2 border border-jade-500/25 bg-jade-950/40 px-5 py-4 text-sm text-jade-400">
          This draw was published {dateTime(draw.published_at)}. Results, tiers and winners are final and
          cannot be edited.
        </div>
      )}

      {/* Published result */}
      {published && (
        <GlassPanel className="mb-6 p-6">
          <Eyebrow>Winning numbers</Eyebrow>
          <div className="mt-4">
            <NumberRow numbers={draw.winning_numbers ?? []} size="lg" animate />
          </div>
          {Number(draw.rollover_minor) > 0 && (
            <p className="mt-5 rounded-xl border border-gold-500/25 bg-gold-950/40 px-4 py-3 text-sm text-gold-400">
              {money(draw.rollover_minor)} rolled over — the jackpot went unclaimed and carries into the next draw.
            </p>
          )}
        </GlassPanel>
      )}

      {/* Simulation review */}
      {!published && review && (
        <section className="mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Eyebrow>Simulation result — not committed</Eyebrow>
            <span className="font-mono text-xs text-mist-400">seed {reviewSeed}</span>
          </div>

          <GlassPanel className="p-6">
            <NumberRow numbers={review.numbers ?? []} size="lg" animate />

            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              <MiniStat label="Pool" value={money(review.poolMinor, { compact: true })} tone="gold" />
              <MiniStat label="Distributed" value={money(review.distributedMinor, { compact: true })} tone="jade" />
              <MiniStat label="Rollover" value={money(review.rolloverMinor, { compact: true })} tone="coral" />
              <MiniStat label="Entries evaluated" value={number(review.entryCount)} />
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div>
                <Eyebrow className="mb-3">Tiers</Eyebrow>
                <ul className="space-y-2">
                  {(review.tiers ?? []).map((tier) => (
                    <li
                      key={tier.matchCount}
                      className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-ink-800/60 px-4 py-3 text-sm"
                    >
                      <span className="text-ivory-dim">{tier.matchCount} matched</span>
                      <span className="text-ivory-faint">
                        {number(tier.winners?.length ?? tier.winnerCount ?? 0)} winner
                        {(tier.winners?.length ?? tier.winnerCount ?? 0) === 1 ? '' : 's'}
                      </span>
                      <span className="numeric text-gold-400">{money(tier.amountMinor ?? 0)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Eyebrow className="mb-3">Would win</Eyebrow>
                {review.awards?.length ? (
                  <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {review.awards.map((award) => (
                      <li
                        key={`${award.userId}-${award.matchCount}`}
                        className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-ink-800/60 px-4 py-3 text-sm"
                      >
                        <span className="text-ivory-dim">{award.name ?? award.email}</span>
                        <Badge tone={award.matchCount === 5 ? 'gold' : award.matchCount === 4 ? 'coral' : 'jade'}>
                          {award.matchCount} matched
                        </Badge>
                        <span className="numeric text-ivory">{money(award.amountMinor)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-white/[0.07] bg-ink-800/60 px-4 py-6 text-center text-sm text-ivory-faint">
                    Nobody matched three or more. The jackpot tier would roll over.
                  </p>
                )}
              </div>
            </div>
          </GlassPanel>
        </section>
      )}

      {/* Published tiers + winners */}
      {published && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="solid-panel p-6">
            <Eyebrow>Prize tiers</Eyebrow>
            <ul className="mt-4 space-y-2">
              {(tiers ?? []).map((tier) => (
                <li
                  key={tier.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-ink-800/60 px-4 py-3 text-sm"
                >
                  <span className="text-ivory-dim">{tier.match_count} matched</span>
                  <span className="text-ivory-faint">
                    {number(tier.winner_count)} × {money(tier.per_winner_minor)}
                  </span>
                  <span className="numeric text-gold-400">{money(tier.amount_minor)}</span>
                  {tier.rolled_over && <Badge tone="coral">rolled</Badge>}
                </li>
              ))}
            </ul>
          </div>

          <div className="solid-panel p-6">
            <Eyebrow>Winners</Eyebrow>
            {winners?.length ? (
              <ul className="mt-4 space-y-2">
                {winners.map((winner) => (
                  <li
                    key={winner.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-ink-800/60 px-4 py-3 text-sm"
                  >
                    <span className="text-ivory-dim">
                      {winner.first_name} {winner.last_name}
                    </span>
                    <Badge status={winner.state}>{String(winner.state).replace(/_/g, ' ')}</Badge>
                    <span className="numeric text-ivory">{money(winner.amount_minor)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ivory-faint">No winners in this draw.</p>
            )}
          </div>
        </div>
      )}

      {/* Simulation history */}
      {simulations?.length > 0 && (
        <section className="mt-8">
          <Eyebrow className="mb-4">Simulation history</Eyebrow>
          <ul className="space-y-2">
            {simulations.map((simulation) => (
              <li
                key={simulation.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-ink-700/50 px-4 py-3 text-sm"
              >
                <span className="font-mono text-xs text-mist-400">seed {simulation.seed}</span>
                <span className="text-xs text-ivory-faint">{simulation.strategy}</span>
                <NumberRow numbers={simulation.result?.numbers ?? []} size="sm" />
                <span className="text-xs text-mist-400">{dateTime(simulation.created_at)}</span>
                {!published && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLatest({ ...simulation.result, seed: simulation.seed })}
                  >
                    Review
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!published && !review && entryCount === 0 && (
        <EmptyState
          className="mt-8"
          icon="◷"
          title="No entries in the field"
          description="Rebuild entries to compile one ticket per entitled member from their retained scores."
          action={
            <Button onClick={refreshEntries} loading={refreshing}>
              Rebuild entries
            </Button>
          }
        />
      )}

      <ConfigureModal
        open={configuring}
        draw={draw}
        onClose={() => setConfiguring(false)}
        onSaved={async () => {
          setConfiguring(false);
          toast.success('Draw updated.');
          await reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(publishFor)}
        onClose={() => setPublishFor(null)}
        onConfirm={publish}
        loading={publishing}
        variant="gold"
        title="Publish this draw?"
        description="Results, prize tiers, winners and any rollover are written in one transaction. A published draw cannot be edited or re-run."
        confirmLabel="Publish draw"
      >
        {publishFor && (
          <div className="rounded-xl border border-gold-500/25 bg-gold-950/40 px-4 py-3 text-sm text-gold-400">
            Publishing with seed <span className="font-mono">{publishFor.seed}</span> using the{' '}
            {publishFor.strategy} method — the same result you just reviewed.
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

function ConfigureModal({ open, draw, onClose, onSaved }) {
  const [strategy, setStrategy] = useState(draw?.strategy ?? 'random');
  const [entriesCloseAt, setEntriesCloseAt] = useState(
    draw?.entries_close_at ? String(draw.entries_close_at).slice(0, 16) : ''
  );
  const [drawAt, setDrawAt] = useState(draw?.draw_at ? String(draw.draw_at).slice(0, 16) : '');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { strategy };
      if (entriesCloseAt) body.entriesCloseAt = new Date(entriesCloseAt).toISOString();
      if (drawAt) body.drawAt = new Date(drawAt).toISOString();
      await api.patch(`/admin/draws/${draw.id}`, body);
      await onSaved();
    } catch (cause) {
      setError(cause);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configure draw"
      description="Selection method and timings. These can only change before the draw is published."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError error={error} />

        <Field label="Selection method">
          <Select value={strategy} onChange={(event) => setStrategy(event.target.value)}>
            <option value="random">Random</option>
            <option value="weighted">Score-weighted</option>
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entries close">
            <Input
              type="datetime-local"
              value={entriesCloseAt}
              onChange={(event) => setEntriesCloseAt(event.target.value)}
            />
          </Field>
          <Field label="Draw runs">
            <Input type="datetime-local" value={drawAt} onChange={(event) => setDrawAt(event.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
