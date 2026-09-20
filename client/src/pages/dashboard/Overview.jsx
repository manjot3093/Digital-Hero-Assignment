import { Link } from 'react-router-dom';
import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { date, money, number, relativeDays } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { GlassPanel, PageHeader, Eyebrow } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, LoadingPanel } from '../../components/ui/Feedback.jsx';
import Countdown from '../../components/ui/Countdown.jsx';
import { NumberRow } from '../../components/ui/NumberBall.jsx';
import { MiniStat } from '../../components/ui/Stat.jsx';

/**
 * One request assembles this whole screen (GET /api/dashboard), so the member
 * sees a consistent snapshot rather than six panels resolving at different
 * times against slightly different state.
 */
export default function DashboardOverview() {
  const { data, loading, error, reload } = useAsync(() => api.get('/dashboard'), []);

  if (loading) return <LoadingPanel rows={5} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { user, subscription, charity, scores, draw, winnings, participation } = data;
  const needsAttention = !subscription.entitled || !charity || scores.items.length === 0;

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user.firstName}.`}
        description="Your membership, your cause and this month's draw at a glance."
        actions={<Button to="/dashboard/scores" size="sm">Log a score</Button>}
      />

      {/* Setup prompts — only shown while something is genuinely missing. */}
      {needsAttention && (
        <div className="mb-8 space-y-3">
          {!subscription.entitled && (
            <SetupRow
              tone="coral"
              title="Your membership isn't active"
              body={
                subscription.status
                  ? `Status: ${String(subscription.status).replace('_', ' ')}. Draw entry and score logging are paused until it's resolved.`
                  : 'Start a plan to log scores and enter the monthly draw.'
              }
              action={<Button to="/dashboard/subscription" size="sm">Sort out membership</Button>}
            />
          )}
          {!charity && (
            <SetupRow
              tone="jade"
              title="You haven't chosen a cause"
              body="At least 10% of every payment goes to a charity you pick. Nothing is allocated until you choose one."
              action={<Button to="/dashboard/charity" size="sm" variant="jade">Choose a charity</Button>}
            />
          )}
          {scores.items.length === 0 && subscription.entitled && (
            <SetupRow
              tone="neutral"
              title="No scores logged yet"
              body="Your Stableford points form your draw ticket. Add your most recent round to get started."
              action={<Button to="/dashboard/scores" size="sm" variant="outline">Add your first score</Button>}
            />
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        {/* This month's draw */}
        <GlassPanel className="p-6 sm:p-7">
          {draw ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Eyebrow>This month · {draw.reference}</Eyebrow>
                <Badge status={draw.status}>{draw.status}</Badge>
              </div>

              <p className="mt-5 font-display text-4xl font-semibold text-gold-400">
                {money(draw.poolMinor, { compact: true })}
              </p>
              <p className="mt-2 text-sm text-ivory-faint">
                Pool from {number(draw.subscriberCount)} members
                {draw.carriedInMinor > 0 && <> · {money(draw.carriedInMinor)} rolled over</>}
              </p>

              <div className="mt-7">
                <Countdown target={draw.entriesCloseAt ?? draw.drawAt} label="Entries close in" />
              </div>

              <div className="mt-7 border-t border-white/[0.08] pt-6">
                <Eyebrow className="mb-3">Your numbers</Eyebrow>
                {draw.myNumbers?.length ? (
                  <NumberRow numbers={draw.myNumbers} animate />
                ) : (
                  <p className="text-sm text-ivory-faint">
                    Your ticket is built when entries are compiled. Log your scores and it will appear here.
                  </p>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon="◷"
              title="No draw is open"
              description="The next monthly draw hasn't been scheduled yet. Your scores are kept and carry into it."
              className="border-0 bg-transparent"
            />
          )}
        </GlassPanel>

        {/* Right column */}
        <div className="space-y-5">
          {/* Charity */}
          <div className="solid-panel p-6">
            <Eyebrow>Your cause</Eyebrow>
            {charity ? (
              <>
                <h2 className="mt-3 font-display text-lg font-semibold text-ivory">{charity.name}</h2>
                <p className="mt-1.5 text-sm text-ivory-faint">{charity.tagline}</p>
                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.1em] text-ivory-faint">Your share</p>
                    <p className="numeric mt-1 font-display text-2xl font-semibold text-jade-400">
                      {charity.percent}%
                    </p>
                  </div>
                  {charity.perPaymentMinor != null && (
                    <p className="text-sm text-ivory-faint">
                      {money(charity.perPaymentMinor)} per payment
                    </p>
                  )}
                </div>
                <div className="mt-5 flex gap-2">
                  <Button to="/dashboard/charity" variant="outline" size="sm">Adjust</Button>
                  <Button to={`/charities/${charity.slug}`} variant="ghost" size="sm">View profile</Button>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-ivory-faint">
                No charity selected yet. <Link to="/dashboard/charity" className="text-jade-400 underline underline-offset-4">Pick one</Link>.
              </p>
            )}
          </div>

          {/* Scores */}
          <div className="solid-panel p-6">
            <div className="flex items-center justify-between gap-4">
              <Eyebrow>Retained scores</Eyebrow>
              <span className="font-mono text-xs text-mist-400">
                {scores.retention.used}/{scores.retention.max}
              </span>
            </div>

            {scores.items.length ? (
              <>
                <ul className="mt-4 space-y-2">
                  {scores.items.map((score) => (
                    <li
                      key={score.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-ink-800/60 px-3.5 py-2.5 text-sm"
                    >
                      <span className="text-ivory-faint">{date(score.playedOn)}</span>
                      <span className="truncate px-3 text-xs text-mist-400">{score.courseName ?? '—'}</span>
                      <span className="numeric font-display text-base font-semibold text-ivory">{score.value}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-4 text-center">
                  <div>
                    <dt className="text-[0.66rem] uppercase tracking-[0.1em] text-ivory-faint">Best</dt>
                    <dd className="numeric mt-1 font-display text-lg text-gold-400">{scores.summary.best ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.66rem] uppercase tracking-[0.1em] text-ivory-faint">Average</dt>
                    <dd className="numeric mt-1 font-display text-lg text-ivory">
                      {scores.summary.average != null ? scores.summary.average.toFixed(1) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.66rem] uppercase tracking-[0.1em] text-ivory-faint">Latest</dt>
                    <dd className="numeric mt-1 font-display text-lg text-ivory">{scores.summary.latest ?? '—'}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="mt-4 text-sm text-ivory-faint">Nothing logged yet.</p>
            )}

            <Button to="/dashboard/scores" variant="ghost" size="sm" className="mt-4 w-full">
              Manage scores →
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Total won" value={money(winnings.totalWonMinor, { compact: true })} tone="gold" />
        <MiniStat label="Paid out" value={money(winnings.paidMinor, { compact: true })} tone="jade" />
        <MiniStat
          label="Awaiting proof"
          value={number(winnings.awaitingProof)}
          tone={winnings.awaitingProof > 0 ? 'coral' : 'ivory'}
          hint={winnings.awaitingProof > 0 ? 'Upload a screenshot to claim' : undefined}
        />
        <MiniStat label="Draws entered" value={number(participation.drawsEntered)} />
      </div>

      {/* Recent participation */}
      {participation.history.length > 0 && (
        <section className="mt-8">
          <Eyebrow className="mb-4">Recent draws</Eyebrow>
          <ul className="space-y-2.5">
            {participation.history.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl2 border border-white/[0.07] bg-ink-700/55 px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-gold-400">{entry.reference}</span>
                  <span className="text-xs text-ivory-faint">{relativeDays(entry.draw_at)}</span>
                </div>
                <NumberRow
                  numbers={entry.numbers ?? []}
                  matches={entry.winning_numbers ?? []}
                  size="sm"
                />
                <span className="text-sm">
                  {entry.match_count != null ? (
                    <span className="text-jade-400">
                      {entry.match_count} matched · {money(entry.amount_minor ?? 0)}
                    </span>
                  ) : (
                    <span className="text-mist-400">
                      {entry.status === 'published' ? 'No match' : 'Awaiting draw'}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function SetupRow({ tone, title, body, action }) {
  const tones = {
    coral: 'border-coral-500/30 bg-coral-950/40',
    jade: 'border-jade-500/30 bg-jade-950/40',
    neutral: 'border-white/[0.09] bg-ink-700/60',
  };
  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 rounded-xl2 border px-5 py-4 ${tones[tone]}`}>
      <div>
        <p className="font-display text-sm font-medium text-ivory">{title}</p>
        <p className="mt-1 max-w-xl text-sm text-ivory-faint">{body}</p>
      </div>
      {action}
    </div>
  );
}
