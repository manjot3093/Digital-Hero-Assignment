import { useState } from 'react';
import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { date, dateTime, money, number } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { Eyebrow, GlassPanel, SectionHeading } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import Countdown from '../../components/ui/Countdown.jsx';
import { NumberRow } from '../../components/ui/NumberBall.jsx';

/**
 * Public draw record: the live draw with its countdown and pool, then every
 * published draw with its numbers, tier split and winner count.
 */
export default function Draws() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [current, list] = await Promise.all([api.get('/draws/current'), api.get('/draws')]);
    return { current, draws: list.draws ?? [] };
  }, []);

  const current = data?.current?.draw ? data.current : null;
  const published = (data?.draws ?? []).filter((row) => row.status === 'published');

  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-5 pb-10 pt-16 sm:px-8">
        <Eyebrow>Monthly draws</Eyebrow>
        <h1 className="mt-5 max-w-3xl text-display text-ivory">
          Every number,
          <br />
          every month<span className="text-gold-500">.</span>
        </h1>
        <p className="mt-6 max-w-xl leading-relaxed text-ivory-dim">
          Draws run once a month. An administrator simulates the result and reviews it before anything is
          published — and once published, nothing about it can be edited.
        </p>
      </section>

      {loading && (
        <section className="mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8">
          <Skeleton className="h-64 w-full" />
        </section>
      )}

      {error && (
        <section className="mx-auto w-full max-w-3xl px-5 pb-16 sm:px-8">
          <ErrorState error={error} onRetry={reload} />
        </section>
      )}

      {/* Live draw */}
      {!loading && current && (
        <section className="mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8">
          <GlassPanel className="grid gap-10 p-7 lg:grid-cols-[1.1fr_0.9fr] sm:p-9">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge status={current.draw.status}>{current.draw.status}</Badge>
                <span className="font-mono text-sm text-ivory-faint">{current.draw.reference}</span>
              </div>

              <p className="mt-6 eyebrow">Prize pool, calculated live</p>
              <p className="mt-3 font-display text-6xl font-semibold tracking-tight text-gold-400">
                {money(current.pool?.total_minor ?? current.pool?.totalMinor ?? 0, { compact: true })}
              </p>
              <p className="mt-3 text-sm text-ivory-faint">
                From {number(current.pool?.subscriber_count ?? current.pool?.subscriberCount ?? 0)} paying members
                {Number(current.draw.carried_in_minor) > 0 && (
                  <> · includes {money(current.draw.carried_in_minor)} rolled over</>
                )}
              </p>

              <div className="mt-8">
                <Countdown target={current.draw.entries_close_at ?? current.draw.draw_at} label="Entries close in" />
              </div>

              <p className="mt-6 text-sm text-ivory-faint">
                Drawn on {dateTime(current.draw.draw_at)} using the{' '}
                <span className="text-ivory">{current.draw.strategy === 'weighted' ? 'score-weighted' : 'random'}</span>{' '}
                method.
              </p>
            </div>

            <div>
              <p className="eyebrow">Tier allocation</p>
              <ul className="mt-5 space-y-3">
                {[
                  { match: 5, share: 0.4, label: 'Jackpot — rolls over', tone: 'text-gold-400', bar: 'bg-gold-500' },
                  { match: 4, share: 0.35, label: 'Split between winners', tone: 'text-coral-400', bar: 'bg-coral-500' },
                  { match: 3, share: 0.25, label: 'Split between winners', tone: 'text-jade-400', bar: 'bg-jade-500' },
                ].map((tier) => {
                  const total = Number(current.pool?.total_minor ?? current.pool?.totalMinor ?? 0);
                  return (
                    <li key={tier.match} className="rounded-xl2 border border-white/[0.07] bg-ink-800/60 p-4">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-display text-sm font-medium text-ivory">
                          {tier.match} numbers matched
                        </span>
                        <span className={`numeric font-display text-lg font-semibold ${tier.tone}`}>
                          {money(Math.floor(total * tier.share), { compact: true })}
                        </span>
                      </div>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink-500">
                        <div className={`h-full rounded-full ${tier.bar}`} style={{ width: `${tier.share * 100}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-mist-400">
                        {Math.round(tier.share * 100)}% · {tier.label}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <Button to="/register" className="mt-6 w-full">
                Enter this draw
              </Button>
            </div>
          </GlassPanel>
        </section>
      )}

      {!loading && !current && !error && (
        <section className="mx-auto w-full max-w-3xl px-5 pb-16 sm:px-8">
          <EmptyState
            icon="◷"
            title="No draw is open right now"
            description="The next monthly draw is being scheduled. Past results are below."
            action={<Button to="/register">Join before it opens</Button>}
          />
        </section>
      )}

      {/* History */}
      <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
        <SectionHeading eyebrow="Results" title="Published draws" lead="Numbers, pools and winners, oldest at the bottom." />

        {!loading && published.length === 0 ? (
          <EmptyState
            className="mt-10"
            icon="▱"
            title="No draws published yet"
            description="Results appear here the moment an administrator publishes a draw."
          />
        ) : (
          <div className="mt-10 space-y-4">
            {published.map((draw) => (
              <PublishedDraw key={draw.id} draw={draw} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function PublishedDraw({ draw }) {
  const [open, setOpen] = useState(false);
  const detail = useAsync(() => (open ? api.get(`/draws/${draw.id}`) : Promise.resolve(null)), [open, draw.id]);

  return (
    <article className="overflow-hidden rounded-panel border border-white/[0.08] bg-ink-700/55">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full flex-col gap-5 p-6 text-left transition-colors hover:bg-white/[0.02] lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-mono text-sm text-gold-400">{draw.reference}</span>
          <span className="text-sm text-ivory-faint">{date(draw.published_at ?? draw.draw_at)}</span>
          <Badge status={draw.strategy === 'weighted' ? 'pending' : 'open'}>
            {draw.strategy === 'weighted' ? 'weighted' : 'random'}
          </Badge>
        </div>

        <NumberRow numbers={draw.winning_numbers ?? []} size="sm" />

        <div className="flex items-center gap-6 text-sm">
          <span className="text-ivory">{money(draw.total_minor ?? 0, { compact: true })} pool</span>
          <span className="text-ivory-faint">
            {number(draw.winner_count ?? 0)} winner{Number(draw.winner_count) === 1 ? '' : 's'}
          </span>
          <span aria-hidden="true" className={`text-mist-400 transition-transform ${open ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/[0.07] px-6 py-6">
          {detail.loading && <Skeleton className="h-24 w-full" />}
          {detail.data && (
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <p className="eyebrow mb-4">Tier results</p>
                <ul className="space-y-2.5">
                  {(detail.data.tiers ?? []).map((tier) => (
                    <li
                      key={tier.id ?? tier.match_count}
                      className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-ink-800/60 px-4 py-3 text-sm"
                    >
                      <span className="text-ivory-dim">{tier.match_count} matched</span>
                      <span className="text-ivory-faint">
                        {number(tier.winner_count)} winner{Number(tier.winner_count) === 1 ? '' : 's'}
                      </span>
                      <span className="numeric text-gold-400">{money(tier.amount_minor ?? 0)}</span>
                    </li>
                  ))}
                </ul>
                {Number(detail.data.draw?.rollover_minor) > 0 && (
                  <p className="mt-4 rounded-xl border border-gold-500/25 bg-gold-950/40 px-4 py-3 text-sm text-gold-400">
                    {money(detail.data.draw.rollover_minor)} rolled into the following draw — the jackpot went unclaimed.
                  </p>
                )}
              </div>

              <div>
                <p className="eyebrow mb-4">Winners</p>
                {detail.data.winners?.length ? (
                  <ul className="space-y-2.5">
                    {detail.data.winners.map((winner) => (
                      <li
                        key={winner.id}
                        className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-ink-800/60 px-4 py-3 text-sm"
                      >
                        <span className="text-ivory-dim">
                          {winner.first_name} {String(winner.last_name ?? '').charAt(0)}.
                        </span>
                        <Badge status={winner.state}>{String(winner.state).replace(/_/g, ' ')}</Badge>
                        <span className="numeric text-ivory">{money(winner.amount_minor)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ivory-faint">Nobody matched three or more numbers in this draw.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
