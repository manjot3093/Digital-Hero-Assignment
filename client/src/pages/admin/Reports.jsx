import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { money, number } from '../../lib/format.js';
import { PageHeader, Eyebrow } from '../../components/ui/Panel.jsx';
import { ErrorState, LoadingPanel } from '../../components/ui/Feedback.jsx';
import { MiniStat } from '../../components/ui/Stat.jsx';
import {
  CharityContributionChart,
  ParticipationChart,
  PlanSplitChart,
  PrizePoolChart,
  ScoreSpreadChart,
  SubscriberGrowthChart,
  TopCharitiesChart,
  WinnerDistributionChart,
} from '../../components/charts/Charts.jsx';

/**
 * Reporting. Everything on this page is computed by SQL aggregates in
 * reportService and rendered as-is — no figure is derived in the browser.
 */
export default function AdminReports() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [charts, overview] = await Promise.all([api.get('/admin/reports'), api.get('/admin/overview')]);
    return { charts, overview };
  }, []);

  if (loading) return <LoadingPanel rows={8} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { charts, overview } = data;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Growth, giving, prize pools and participation, queried live from the database."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Accounts" value={number(overview.users.total)} />
        <MiniStat label="Active members" value={number(overview.subscriptions.activeCount)} tone="jade" />
        <MiniStat
          label="Charity total"
          value={money(overview.charity.totalMinor, { compact: true })}
          tone="jade"
          hint={`${money(overview.charity.donationMinor, { compact: true })} direct donations`}
        />
        <MiniStat
          label="Winner payouts"
          value={money(overview.winners.paidMinor, { compact: true })}
          tone="gold"
          hint={`${money(overview.winners.outstandingMinor, { compact: true })} outstanding`}
        />
      </div>

      <Eyebrow className="mb-4">Growth and giving</Eyebrow>
      <div className="grid gap-5 lg:grid-cols-2">
        <SubscriberGrowthChart data={charts.subscriberGrowth} />
        <CharityContributionChart data={charts.charityContributions} />
      </div>

      <Eyebrow className="mb-4 mt-8">Draws</Eyebrow>
      <div className="grid gap-5 lg:grid-cols-2">
        <PrizePoolChart data={charts.prizePoolHistory} />
        <ParticipationChart data={charts.drawParticipation} />
        <WinnerDistributionChart data={charts.winnerDistribution} />
        <ScoreSpreadChart data={charts.scoreDistribution} />
      </div>

      <Eyebrow className="mb-4 mt-8">Membership and causes</Eyebrow>
      <div className="grid gap-5 lg:grid-cols-2">
        <PlanSplitChart data={charts.planDistribution} />
        <TopCharitiesChart data={charts.topCharities} />
      </div>

      <p className="mt-8 text-xs leading-relaxed text-mist-400">
        Monthly series cover the last twelve months. Charity contributions are recorded against successful
        subscription payments; direct donations are counted separately and shown in the headline figure above.
      </p>
    </>
  );
}
