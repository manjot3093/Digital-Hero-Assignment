import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { ApiError } from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { date, money, number } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { GlassPanel, PageHeader, Eyebrow } from '../../components/ui/Panel.jsx';
import { EmptyState, ErrorState, LoadingPanel, Skeleton } from '../../components/ui/Feedback.jsx';
import { FormError, Input, PercentSlider } from '../../components/ui/Form.jsx';

/**
 * Choose a cause and set the share. The projected split shown while dragging
 * the slider is a preview; the authoritative split is recomputed server-side
 * when each payment is recorded.
 */
export default function DashboardCharity() {
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const dashboard = useAsync(() => api.get('/dashboard'), []);
  const [search, setSearch] = useState('');
  const directory = useAsync(
    () => api.get('/charities', { query: { search, pageSize: 48 } }),
    [search]
  );

  const [percent, setPercent] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const current = dashboard.data?.charity ?? null;
  const subscription = dashboard.data?.subscription ?? null;
  const effectivePercent = percent ?? current?.percent ?? user?.charityPercent ?? 10;
  const targetId = selectedId ?? current?.id ?? null;

  const projection = useMemo(() => {
    const amount = Number(subscription?.plan?.amountMinor ?? 0);
    if (!amount) return null;
    const charityMinor = Math.round((amount * effectivePercent) / 100);
    return {
      amount,
      charityMinor,
      remainderMinor: amount - charityMinor,
      annualMinor: subscription.plan.interval === 'year' ? charityMinor : charityMinor * 12,
    };
  }, [subscription, effectivePercent]);

  if (dashboard.loading) return <LoadingPanel rows={4} />;
  if (dashboard.error) return <ErrorState error={dashboard.error} onRetry={dashboard.reload} />;

  const save = async () => {
    if (!targetId) {
      setError(new ApiError('Choose a charity first.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/users/charity', { charityId: targetId, charityPercent: effectivePercent });
      await Promise.all([refreshUser(), dashboard.reload()]);
      setSelectedId(null);
      setPercent(null);
      toast.success('Your charity selection has been saved.');
    } catch (cause) {
      setError(cause);
    } finally {
      setSaving(false);
    }
  };

  const dirty = (selectedId && selectedId !== current?.id) || (percent !== null && percent !== current?.percent);

  return (
    <>
      <PageHeader
        title="Your cause"
        description="Pick the charity your subscription funds and decide how much of it goes there."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        {/* Current selection + slider */}
        <GlassPanel className="p-6 sm:p-7">
          <Eyebrow>Currently supporting</Eyebrow>
          {current ? (
            <>
              <h2 className="mt-3 font-display text-2xl font-semibold text-ivory">{current.name}</h2>
              <p className="mt-1.5 text-sm text-ivory-faint">{current.tagline}</p>
              <Link
                to={`/charities/${current.slug}`}
                className="mt-2 inline-block text-sm text-jade-400 underline underline-offset-4"
              >
                View charity profile
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-ivory-faint">
              You haven&apos;t chosen a cause yet. Select one from the list and set your share.
            </p>
          )}

          <div className="mt-7 border-t border-white/[0.08] pt-6">
            <PercentSlider
              value={effectivePercent}
              onChange={setPercent}
              footnote="The 10% floor and 100% ceiling are enforced by the API and by a CHECK constraint in the database."
            />
          </div>

          {projection ? (
            <dl className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.07] bg-ink-800/60 px-4 py-3.5">
                <dt className="text-xs uppercase tracking-[0.1em] text-ivory-faint">Per payment</dt>
                <dd className="numeric mt-1.5 font-display text-xl font-semibold text-jade-400">
                  {money(projection.charityMinor)}
                </dd>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-ink-800/60 px-4 py-3.5">
                <dt className="text-xs uppercase tracking-[0.1em] text-ivory-faint">Everything else</dt>
                <dd className="numeric mt-1.5 font-display text-xl font-semibold text-ivory">
                  {money(projection.remainderMinor)}
                </dd>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-ink-800/60 px-4 py-3.5">
                <dt className="text-xs uppercase tracking-[0.1em] text-ivory-faint">Over a year</dt>
                <dd className="numeric mt-1.5 font-display text-xl font-semibold text-gold-400">
                  {money(projection.annualMinor, { compact: true })}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-6 rounded-xl border border-white/[0.08] bg-ink-800/60 px-4 py-3.5 text-sm text-ivory-faint">
              Start a membership to see what your percentage means in money.{' '}
              <Link to="/dashboard/subscription" className="text-jade-400 underline underline-offset-4">
                Choose a plan
              </Link>
              .
            </p>
          )}

          <div className="mt-6">
            <FormError error={error} />
          </div>

          <Button variant="jade" className="mt-5 w-full" onClick={save} loading={saving} disabled={!dirty && Boolean(current)}>
            {current ? 'Save changes' : 'Save selection'}
          </Button>
        </GlassPanel>

        {/* Contribution history */}
        <div className="solid-panel p-6">
          <Eyebrow>Your contributions</Eyebrow>
          {dashboard.data.donations?.length ? (
            <ul className="mt-4 space-y-2.5">
              {dashboard.data.donations.map((donation) => (
                <li
                  key={donation.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-ink-800/60 px-4 py-3 text-sm"
                >
                  <span className="text-ivory-faint">{date(donation.created_at)}</span>
                  <span className="text-xs text-mist-400">{donation.status}</span>
                  <span className="numeric text-jade-400">{money(donation.amount_minor)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ivory-faint">
              Direct donations you make will be listed here. They are separate from your subscription split.
            </p>
          )}

          <div className="mt-6 border-t border-white/[0.07] pt-5">
            <Eyebrow>Give directly</Eyebrow>
            <p className="mt-2 text-sm text-ivory-faint">
              One-off donations go straight to the charity and have no effect on your draw entry.
            </p>
            <Button to="/charities" variant="outline" size="sm" className="mt-4">
              Browse the directory
            </Button>
          </div>
        </div>
      </div>

      {/* Picker */}
      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <Eyebrow>Choose a different cause</Eyebrow>
          <div className="w-full sm:w-72">
            <Input
              type="search"
              placeholder="Search charities"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {directory.loading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        )}

        {!directory.loading && (directory.data?.charities ?? []).length === 0 && (
          <EmptyState icon="⌕" title="No charities match" description="Try a different search term." />
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(directory.data?.charities ?? []).map((charity) => {
            const active = targetId === charity.id;
            return (
              <button
                key={charity.id}
                type="button"
                onClick={() => setSelectedId(charity.id)}
                className={`rounded-xl2 border p-4 text-left transition-colors ${
                  active
                    ? 'border-jade-500/60 bg-jade-950/50'
                    : 'border-white/[0.07] bg-ink-700/50 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-sm font-semibold text-ivory">{charity.name}</h3>
                  {active && <span className="text-xs text-jade-400">Selected</span>}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ivory-faint">{charity.tagline}</p>
                <p className="mt-3 text-xs text-mist-400">
                  {money(charity.raised_minor, { compact: true })} raised · {number(charity.supporter_count)} members
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
