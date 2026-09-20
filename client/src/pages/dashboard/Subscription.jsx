import { useState } from 'react';
import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { date, money, titleCase } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { GlassPanel, PageHeader, Eyebrow } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, LoadingPanel } from '../../components/ui/Feedback.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';

const STATUS_COPY = {
  active: 'Your membership is active. You can log scores and you are entered in every monthly draw.',
  trialing: 'You are in a trial period with full member access.',
  past_due: 'A payment failed. Score entry and draw participation are paused until it clears.',
  cancelled: 'Your membership has been cancelled. You keep read access to your history.',
  expired: 'Your membership has lapsed. Restart a plan to rejoin the draw.',
};

/**
 * Membership. Checkout, the billing portal and cancellation all round-trip
 * through the payment provider — this page never marks anything paid itself.
 */
export default function DashboardSubscription() {
  const toast = useToast();
  const { refreshSubscription } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    const [mine, plans] = await Promise.all([api.get('/subscription'), api.get('/subscription/plans')]);
    return { mine, plans: plans.plans };
  }, []);

  const [busy, setBusy] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (loading) return <LoadingPanel rows={4} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const subscription = data.mine.subscription;
  const status = data.mine.status;
  const entitled = data.mine.entitled;

  const checkout = async (planCode) => {
    setBusy(planCode);
    try {
      const result = await api.post('/subscription/checkout', { planCode });
      if (result?.checkoutUrl) window.location.href = result.checkoutUrl;
      else toast.error('The payment provider did not return a checkout link.');
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy('portal');
    try {
      const result = await api.post('/subscription/portal');
      if (result?.portalUrl) window.location.href = result.portalUrl;
      else toast.error('The billing portal is not available for this account.');
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy('cancel');
    try {
      await api.post('/subscription/cancel');
      setConfirmCancel(false);
      await Promise.all([reload(), refreshSubscription()]);
      toast.info('Your membership will end when the current period finishes.');
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Membership"
        description="Your plan, your payment history and where each payment goes."
      />

      {subscription ? (
        <GlassPanel className="p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-3">
                <Badge status={status}>{titleCase(status)}</Badge>
                {subscription.cancel_at_period_end && <Badge tone="coral">Ending at period end</Badge>}
              </div>
              <h2 className="mt-4 font-display text-2xl font-semibold text-ivory">
                {subscription.plan_name}
              </h2>
              <p className="mt-1.5 text-sm text-ivory-faint">{STATUS_COPY[status] ?? ''}</p>
            </div>

            <div className="text-right">
              <p className="numeric font-display text-3xl font-semibold text-ivory">
                {money(subscription.amount_minor)}
              </p>
              <p className="mt-1 text-sm text-ivory-faint">
                per {subscription.interval === 'year' ? 'year' : 'month'}
              </p>
            </div>
          </div>

          <dl className="mt-7 grid gap-4 border-t border-white/[0.08] pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-ivory-faint">
                {subscription.cancel_at_period_end ? 'Access ends' : 'Renews'}
              </dt>
              <dd className="mt-1.5 text-sm text-ivory">{date(subscription.current_period_end)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-ivory-faint">Draw entitlement</dt>
              <dd className="mt-1.5 text-sm text-ivory">{entitled ? 'Entered each month' : 'Paused'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-ivory-faint">Started</dt>
              <dd className="mt-1.5 text-sm text-ivory">{date(subscription.created_at)}</dd>
            </div>
          </dl>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button variant="outline" onClick={openPortal} loading={busy === 'portal'}>
              Manage billing
            </Button>
            {!subscription.cancel_at_period_end && status !== 'cancelled' && (
              <Button variant="ghost" onClick={() => setConfirmCancel(true)}>
                Cancel membership
              </Button>
            )}
          </div>
        </GlassPanel>
      ) : (
        <EmptyState
          icon="◷"
          title="No membership yet"
          description="Choose a plan below to start logging scores and entering the monthly draw."
        />
      )}

      {/* Plans */}
      {(!subscription || !entitled) && (
        <section className="mt-10">
          <Eyebrow className="mb-5">{subscription ? 'Restart your membership' : 'Choose a plan'}</Eyebrow>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.plans.map((plan) => (
              <div
                key={plan.code}
                className={`rounded-panel border p-6 ${
                  plan.interval === 'year' ? 'border-gold-500/30 bg-gold-950/15' : 'border-white/[0.08] bg-ink-700/55'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold text-ivory">{plan.name}</h3>
                  {plan.interval === 'year' && <Badge tone="gold">Best value</Badge>}
                </div>
                <p className="mt-4 font-display text-3xl font-semibold text-ivory">
                  {money(plan.amount_minor)}
                  <span className="ml-1.5 text-sm font-normal text-ivory-faint">
                    /{plan.interval === 'year' ? 'yr' : 'mo'}
                  </span>
                </p>
                <ul className="mt-5 space-y-2 text-sm text-ivory-faint">
                  <li>{money(plan.allocation.charityMinor)} to your charity at 10%</li>
                  <li>{money(plan.allocation.prizeMinor)} into the prize pool</li>
                  <li>{money(plan.allocation.platformMinor)} runs the platform</li>
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={plan.interval === 'year' ? 'gold' : 'primary'}
                  onClick={() => checkout(plan.code)}
                  loading={busy === plan.code}
                >
                  Choose {plan.name.toLowerCase()}
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-mist-400">
            Test mode: use card 4242 4242 4242 4242 with any future expiry date and any CVC.
          </p>
        </section>
      )}

      {/* Payments */}
      <section className="mt-10">
        <Eyebrow className="mb-5">Payment history</Eyebrow>
        <DataTable
          keyField="id"
          rows={data.mine.payments ?? []}
          empty={
            <EmptyState
              icon="▤"
              title="No payments recorded"
              description="Successful payments appear here once the provider confirms them by webhook."
            />
          }
          columns={[
            { key: 'created_at', header: 'Date', render: (row) => date(row.paid_at ?? row.created_at) },
            {
              key: 'split',
              header: 'Split',
              render: (row) => (
                <span className="text-xs text-mist-400">
                  {money(row.charity_minor ?? 0)} charity · {money(row.prize_minor ?? 0)} pool
                </span>
              ),
            },
            { key: 'status', header: 'Status', render: (row) => <Badge status={row.status}>{row.status}</Badge> },
            {
              key: 'amount_minor',
              header: 'Amount',
              align: 'right',
              render: (row) => <span className="numeric">{money(row.amount_minor)}</span>,
            },
          ]}
        />
      </section>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancel}
        loading={busy === 'cancel'}
        title="Cancel your membership?"
        description="You stay entitled until the end of the period you have already paid for, including any draw that closes before then."
        confirmLabel="Cancel membership"
      />
    </>
  );
}
