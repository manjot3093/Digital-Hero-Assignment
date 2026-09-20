import { useState } from 'react';
import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { money } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { Eyebrow, GlassPanel, SectionHeading } from '../../components/ui/Panel.jsx';
import { Badge, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { PercentSlider } from '../../components/ui/Form.jsx';

/**
 * Pricing doubles as an explanation of the allocation. The split shown updates
 * live with the slider so the effect of raising the charity share is visible
 * before anyone signs up.
 */
export default function Pricing() {
  const { data, loading, error, reload } = useAsync(() => api.get('/subscription/plans'), []);
  const [percent, setPercent] = useState(10);

  const plans = data?.plans ?? [];

  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-5 pb-12 pt-16 sm:px-8">
        <div className="max-w-3xl">
          <Eyebrow>Plans and allocation</Eyebrow>
          <h1 className="mt-5 text-display text-ivory">
            You can see
            <br />
            where it goes<span className="text-jade-400">.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ivory-dim">
            Every payment is split three ways before anything else happens: your charity, the member prize
            pool, and running the platform. Move the slider to see what a different charity share does.
          </p>
        </div>
      </section>

      {error && (
        <section className="mx-auto w-full max-w-3xl px-5 pb-16 sm:px-8">
          <ErrorState error={error} onRetry={reload} />
        </section>
      )}

      <section className="mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8">
        <GlassPanel className="mb-8 p-7">
          <PercentSlider
            value={percent}
            onChange={setPercent}
            footnote="Raising your charity share reduces the platform's cut first. The prize-pool contribution is fixed, so the draw is never funded at your charity's expense."
          />
        </GlassPanel>

        <div className="grid gap-5 lg:grid-cols-2">
          {loading && Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-96" />)}

          {plans.map((plan) => (
            <PlanCard key={plan.code} plan={plan} percent={percent} />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
        <SectionHeading
          eyebrow="Fine print, plainly"
          title="What the plans do and do not include"
        />

        <dl className="mt-10 grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {[
            {
              q: 'Is the prize contribution the same on both plans?',
              a: 'Yes. The same fixed proportion of every payment funds the pool, so a yearly member contributes the same per month as a monthly member.',
            },
            {
              q: 'Does a yearly plan get more draw entries?',
              a: 'No. Every entitled member gets one entry per monthly draw, regardless of plan. Paying up front costs less per month, that is all.',
            },
            {
              q: 'What happens if a payment fails?',
              a: 'Your membership moves to past due. You keep read access to your dashboard and history, but score entry and draw participation stop until the payment clears.',
            },
            {
              q: 'Can I cancel?',
              a: 'Any time, from your dashboard. You stay entitled until the end of the period you have already paid for, and you remain in any draw that closes before then.',
            },
            {
              q: 'Where does the platform share go?',
              a: 'Payment processing, hosting, verification of winner proof, and running the draw. It is what is left after the charity share and the prize contribution.',
            },
            {
              q: 'Can I give more without subscribing more?',
              a: 'Yes. One-off donations on any charity profile are entirely separate from your subscription and from the draw.',
            },
          ].map((item) => (
            <div key={item.q}>
              <dt className="font-display text-base font-medium text-ivory">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ivory-faint">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto w-full max-w-4xl px-5 pb-8 text-center sm:px-8">
        <h2 className="text-headline text-ivory">Pick a plan, pick a cause.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to="/register" size="lg">Create your account</Button>
          <Button to="/charities" variant="outline" size="lg">Browse charities</Button>
        </div>
      </section>
    </>
  );
}

/**
 * Recomputes the split for the slider position. The authoritative calculation
 * still happens server-side when a payment is recorded; this is a preview.
 */
function PlanCard({ plan, percent }) {
  const amount = Number(plan.amount_minor);
  const prizeShare = Number(plan.prize_share ?? 0.5);
  const charityMinor = Math.round((amount * percent) / 100);
  const prizeMinor = Math.min(Math.round(amount * prizeShare), amount - charityMinor);
  const platformMinor = Math.max(0, amount - charityMinor - prizeMinor);
  const yearly = plan.interval === 'year';
  const perMonth = yearly ? Math.round(amount / 12) : amount;

  const rows = [
    { label: 'Your charity', value: charityMinor, tone: 'bg-jade-500', text: 'text-jade-400' },
    { label: 'Member prize pool', value: prizeMinor, tone: 'bg-gold-500', text: 'text-gold-400' },
    { label: 'Running the platform', value: platformMinor, tone: 'bg-mist-500', text: 'text-ivory-faint' },
  ];

  return (
    <div
      className={`rounded-panel border p-7 ${
        yearly ? 'border-gold-500/35 bg-gold-950/15' : 'border-white/[0.08] bg-ink-700/55'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-ivory">{plan.name}</h2>
          <p className="mt-1 text-sm text-ivory-faint">{plan.description ?? (yearly ? 'Billed once a year' : 'Billed every month')}</p>
        </div>
        {yearly && <Badge tone="gold">Best value</Badge>}
      </div>

      <p className="mt-6 font-display text-5xl font-semibold text-ivory">
        {money(amount)}
        <span className="ml-2 text-base font-normal text-ivory-faint">/{yearly ? 'year' : 'month'}</span>
      </p>
      {yearly && <p className="mt-2 text-sm text-gold-400">Works out at {money(perMonth)} a month</p>}

      {/* Allocation bar */}
      <div className="mt-8">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-500">
          {rows.map((row) => (
            <div
              key={row.label}
              className={row.tone}
              style={{ width: `${(row.value / amount) * 100}%` }}
              title={`${row.label}: ${money(row.value)}`}
            />
          ))}
        </div>
        <dl className="mt-5 space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="text-ivory-faint">{row.label}</dt>
              <dd className={`numeric font-medium ${row.text}`}>
                {money(row.value)}
                <span className="ml-2 text-xs text-mist-400">{Math.round((row.value / amount) * 100)}%</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <ul className="mt-8 space-y-2 border-t border-white/[0.07] pt-6 text-sm text-ivory-faint">
        <li>Five rolling Stableford scores</li>
        <li>One entry in every monthly draw</li>
        <li>Charity share adjustable from 10% to 100%</li>
        <li>Cancel any time — entitlement runs to the period end</li>
      </ul>

      <Button
        to={`/register?plan=${plan.code}`}
        variant={yearly ? 'gold' : 'primary'}
        size="lg"
        className="mt-8 w-full"
      >
        Choose {plan.name.toLowerCase()}
      </Button>
    </div>
  );
}
