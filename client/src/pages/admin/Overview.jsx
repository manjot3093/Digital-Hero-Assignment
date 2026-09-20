import { Link } from 'react-router-dom';
import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { date, dateTime, money, number, titleCase } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { GlassPanel, PageHeader, Eyebrow } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, LoadingPanel } from '../../components/ui/Feedback.jsx';
import { MiniStat } from '../../components/ui/Stat.jsx';

/**
 * Operator landing screen: the numbers that decide what an administrator
 * should do next, and a direct route to each of those jobs.
 */
export default function AdminOverview() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [overview, audit] = await Promise.all([
      api.get('/admin/overview'),
      api.get('/admin/audit', { query: { pageSize: 8 } }),
    ]);
    return { overview, audit: audit.items ?? [] };
  }, []);

  if (loading) return <LoadingPanel rows={6} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { users, subscriptions, prizePool, charity, winners } = data.overview;

  const jobs = [
    {
      count: winners.awaitingProof,
      label: 'wins awaiting proof',
      body: 'Members have been notified in their dashboard but have not uploaded a screenshot yet.',
      to: '/admin/winners',
      tone: 'neutral',
    },
    {
      count: winners.pendingVerification,
      label: 'proofs to verify',
      body: 'Screenshots uploaded and waiting for a decision.',
      to: '/admin/winners',
      tone: 'coral',
    },
    {
      count: winners.outstandingMinor > 0 ? 1 : 0,
      label: 'payouts outstanding',
      body: `${money(winners.outstandingMinor)} approved but not yet marked paid.`,
      to: '/admin/winners',
      tone: 'gold',
    },
  ].filter((job) => job.count > 0);

  return (
    <>
      <PageHeader
        title="Console"
        description="Live platform state. Every figure is queried from the database on load."
        actions={
          <>
            <Button to="/admin/draws" size="sm">Manage draws</Button>
            <Button to="/admin/reports" size="sm" variant="outline">Reports</Button>
          </>
        }
      />

      {jobs.length > 0 && (
        <section className="mb-8">
          <Eyebrow className="mb-4">Needs attention</Eyebrow>
          <div className="grid gap-3 sm:grid-cols-3">
            {jobs.map((job) => (
              <Link
                key={job.label}
                to={job.to}
                className={`rounded-xl2 border px-5 py-4 transition-colors ${
                  job.tone === 'coral'
                    ? 'border-coral-500/30 bg-coral-950/40 hover:bg-coral-950/60'
                    : job.tone === 'gold'
                      ? 'border-gold-500/25 bg-gold-950/40 hover:bg-gold-950/60'
                      : 'border-white/[0.09] bg-ink-700/60 hover:bg-ink-700'
                }`}
              >
                <p className="font-display text-lg font-semibold text-ivory">
                  {job.label === 'payouts outstanding' ? money(winners.outstandingMinor, { compact: true }) : number(job.count)}{' '}
                  <span className="text-sm font-normal text-ivory-faint">{job.label}</span>
                </p>
                <p className="mt-1.5 text-xs text-ivory-faint">{job.body}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Accounts" value={number(users.total)} hint={`${number(users.byRole.admin ?? 0)} admin`} />
            <MiniStat label="Active members" value={number(subscriptions.activeCount)} tone="jade" />
            <MiniStat label="Raised for charity" value={money(charity.totalMinor, { compact: true })} tone="jade" />
            <MiniStat label="Paid to winners" value={money(winners.paidMinor, { compact: true })} tone="gold" />
          </div>

          {/* Current draw */}
          <GlassPanel className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Eyebrow>Current draw</Eyebrow>
              {prizePool.drawStatus && <Badge status={prizePool.drawStatus}>{prizePool.drawStatus}</Badge>}
            </div>

            {prizePool.drawReference ? (
              <>
                <p className="mt-5 font-display text-4xl font-semibold text-gold-400">
                  {money(prizePool.currentMinor, { compact: true })}
                </p>
                <p className="mt-2 text-sm text-ivory-faint">
                  {prizePool.drawReference} · drawn {dateTime(prizePool.drawAt)}
                  {prizePool.carriedInMinor > 0 && <> · {money(prizePool.carriedInMinor)} carried in</>}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button to="/admin/draws" size="sm">Open draw controls</Button>
                </div>
              </>
            ) : (
              <EmptyState
                className="border-0 bg-transparent py-6"
                icon="◷"
                title="No draw scheduled"
                description="Create the next monthly draw to start collecting entries."
                action={<Button to="/admin/draws" size="sm">Create a draw</Button>}
              />
            )}
          </GlassPanel>

          {/* Recent winners */}
          <div className="solid-panel p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <Eyebrow>Recent winners</Eyebrow>
              <Link to="/admin/winners" className="text-xs text-ivory-faint hover:text-ivory">
                View all →
              </Link>
            </div>
            {winners.recent?.length ? (
              <ul className="space-y-2.5">
                {winners.recent.map((winner) => (
                  <li
                    key={winner.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-ink-800/60 px-4 py-3 text-sm"
                  >
                    <span className="text-ivory-dim">
                      {winner.first_name} {winner.last_name}
                    </span>
                    <span className="font-mono text-xs text-mist-400">{winner.reference}</span>
                    <Badge status={winner.state}>{String(winner.state).replace(/_/g, ' ')}</Badge>
                    <span className="numeric text-gold-400">{money(winner.amount_minor)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ivory-faint">No winners recorded yet.</p>
            )}
          </div>
        </div>

        {/* Audit */}
        <div className="solid-panel p-6">
          <Eyebrow>Audit trail</Eyebrow>
          <p className="mt-2 text-xs text-mist-400">
            Every administrative action is recorded with the actor, the entity and a timestamp.
          </p>
          {data.audit.length ? (
            <ol className="mt-5 space-y-3">
              {data.audit.map((entry) => (
                <li key={entry.id} className="border-l border-white/10 pl-4">
                  <p className="font-mono text-xs text-jade-400">{entry.action}</p>
                  <p className="mt-1 text-xs text-ivory-faint">
                    {entry.actor_email ?? 'system'} · {entry.entity_type}
                  </p>
                  <p className="mt-0.5 text-xs text-mist-500">{dateTime(entry.created_at)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 text-sm text-ivory-faint">Nothing logged yet.</p>
          )}
        </div>
      </div>

      {/* Plan mix */}
      <section className="mt-8">
        <Eyebrow className="mb-4">Plan distribution</Eyebrow>
        <div className="grid gap-3 sm:grid-cols-3">
          {subscriptions.planDistribution.map((plan) => (
            <div key={plan.code} className="rounded-xl2 border border-white/[0.07] bg-ink-700/60 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.1em] text-ivory-faint">{plan.name}</p>
              <p className="numeric mt-2 font-display text-2xl font-semibold text-ivory">{number(plan.count)}</p>
            </div>
          ))}
          <div className="rounded-xl2 border border-white/[0.07] bg-ink-700/60 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.1em] text-ivory-faint">Causes supported</p>
            <p className="numeric mt-2 font-display text-2xl font-semibold text-jade-400">
              {number(charity.charitiesSupported)}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
