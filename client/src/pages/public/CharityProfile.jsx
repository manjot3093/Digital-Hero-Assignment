import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api, { ApiError } from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { date, dateTime, money, number } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { Eyebrow, GlassPanel } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Field, FormError, Input, PercentSlider } from '../../components/ui/Form.jsx';

const DONATION_PRESETS = [1000, 2500, 5000, 10000];

/**
 * Charity profile: the story, the impact figures, upcoming events, plus the
 * two ways to give — make this your subscription cause, or donate directly
 * without subscribing at all.
 */
export default function CharityProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const { isAuthenticated, user, refreshUser } = useAuth();

  const { data, loading, error, reload } = useAsync(() => api.get(`/charities/${id}`), [id]);
  const [selectOpen, setSelectOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);

  const charity = data?.charity;
  const donationState = params.get('donation');

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <ErrorState error={error} onRetry={reload} />
        <div className="mt-6 text-center">
          <Button to="/charities" variant="outline">Back to the directory</Button>
        </div>
      </div>
    );
  }

  const metrics = Array.isArray(charity.impact_metrics) ? charity.impact_metrics : [];

  return (
    <>
      {/* Hero */}
      <section className="relative">
        <div className="relative h-64 overflow-hidden sm:h-80">
          {charity.hero_image_url ? (
            <img src={charity.hero_image_url} alt="" className="h-full w-full object-cover opacity-45" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-jade-950 to-ink-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/70 to-transparent" />
        </div>

        <div className="mx-auto -mt-28 w-full max-w-7xl px-5 sm:px-8">
          <Link to="/charities" className="mb-5 inline-block text-sm text-ivory-faint transition-colors hover:text-ivory">
            ← All charities
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="jade">{charity.category}</Badge>
            {charity.is_featured && <Badge tone="gold">Featured</Badge>}
            {charity.region && <span className="text-sm text-ivory-faint">{charity.region}</span>}
          </div>
          <h1 className="mt-4 text-headline text-ivory">{charity.name}</h1>
          {charity.tagline && <p className="mt-3 max-w-2xl text-lg text-ivory-dim">{charity.tagline}</p>}
        </div>
      </section>

      {donationState === 'thanks' && (
        <div className="mx-auto mt-8 w-full max-w-7xl px-5 sm:px-8">
          <div className="rounded-xl2 border border-jade-500/35 bg-jade-950/60 px-5 py-4 text-sm text-jade-400">
            Thank you — your donation is being processed. It will appear in the totals once the payment
            provider confirms it.
          </div>
        </div>
      )}
      {donationState === 'cancelled' && (
        <div className="mx-auto mt-8 w-full max-w-7xl px-5 sm:px-8">
          <div className="rounded-xl2 border border-white/12 bg-ink-700/70 px-5 py-4 text-sm text-ivory-faint">
            That donation was cancelled. Nothing has been charged.
          </div>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.35fr_0.65fr]">
        {/* Story */}
        <div>
          {charity.impact_headline && (
            <p className="mb-8 border-l-2 border-jade-500/60 pl-5 font-display text-xl leading-relaxed text-ivory">
              {charity.impact_headline}
            </p>
          )}

          <div className="space-y-4 leading-relaxed text-ivory-faint">
            {String(charity.description ?? '')
              .split(/\n{2,}/)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>

          {metrics.length > 0 && (
            <div className="mt-10">
              <Eyebrow>Impact</Eyebrow>
              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-xl2 border border-white/[0.08] bg-ink-700/60 p-5">
                    <dt className="text-xs uppercase tracking-[0.1em] text-ivory-faint">{metric.label}</dt>
                    <dd className="mt-2 font-display text-2xl font-semibold text-jade-400">{metric.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Events */}
          <div className="mt-12">
            <Eyebrow>Upcoming events</Eyebrow>
            {data.events?.length ? (
              <ul className="mt-5 divide-y divide-white/[0.07] border-y border-white/[0.07]">
                {data.events.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-4 py-4">
                    <div>
                      <h3 className="font-display text-base font-medium text-ivory">{event.title}</h3>
                      {event.description && <p className="mt-1 max-w-xl text-sm text-ivory-faint">{event.description}</p>}
                      {event.venue && <p className="mt-1 text-xs text-mist-400">{event.venue}</p>}
                    </div>
                    <span className="numeric whitespace-nowrap text-sm text-gold-400">{dateTime(event.starts_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                className="mt-5"
                icon="◷"
                title="No events scheduled"
                description={`${charity.name} hasn't listed an upcoming golf day or fundraiser yet.`}
              />
            )}
          </div>
        </div>

        {/* Give */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <GlassPanel className="p-6">
            <Eyebrow>Raised through Digital Heroes</Eyebrow>
            <p className="mt-3 font-display text-4xl font-semibold text-jade-400">
              {money(data.stats?.raised_minor ?? 0, { compact: true })}
            </p>
            <p className="mt-2 text-sm text-ivory-faint">
              from {number(data.stats?.supporter_count ?? 0)} member{Number(data.stats?.supporter_count) === 1 ? '' : 's'}
              {Number(data.stats?.donated_minor ?? 0) > 0 && (
                <> · {money(data.stats.donated_minor, { compact: true })} in direct donations</>
              )}
            </p>

            <div className="my-6 h-px bg-white/[0.08]" />

            <div className="space-y-3">
              <Button
                variant="jade"
                className="w-full"
                onClick={() => (isAuthenticated ? setSelectOpen(true) : navigate('/register', { state: { charityId: charity.id } }))}
              >
                {user?.charityId === charity.id ? 'Update your share' : 'Make this my cause'}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setDonateOpen(true)}>
                Give a one-off donation
              </Button>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-mist-400">
              Direct donations are entirely separate from the draw — you do not need a membership, and they
              do not affect your entry.
            </p>

            {charity.website_url && (
              <a
                href={charity.website_url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-5 block text-sm text-ivory-faint underline underline-offset-4 transition-colors hover:text-ivory"
              >
                Visit {charity.name}
              </a>
            )}
          </GlassPanel>
        </aside>
      </div>

      <SelectCharityModal
        open={selectOpen}
        onClose={() => setSelectOpen(false)}
        charity={charity}
        currentPercent={user?.charityPercent ?? 10}
        onDone={async () => {
          setSelectOpen(false);
          await refreshUser();
          toast.success(`You are now supporting ${charity.name}.`);
        }}
      />

      <DonateModal open={donateOpen} onClose={() => setDonateOpen(false)} charity={charity} />
    </>
  );
}

function SelectCharityModal({ open, onClose, charity, currentPercent, onDone }) {
  const [percent, setPercent] = useState(currentPercent || 10);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post('/users/charity', { charityId: charity.id, charityPercent: percent });
      await onDone();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'That did not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Support ${charity?.name ?? ''}`}
      description="Set the share of every subscription payment that goes to this cause."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="jade" onClick={submit} loading={saving}>Save selection</Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError error={error} />
        <PercentSlider
          value={percent}
          onChange={setPercent}
          footnote="The 10% floor and 100% ceiling are enforced by the API and by a database constraint, not by this slider."
        />
      </div>
    </Modal>
  );
}

function DonateModal({ open, onClose, charity }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState(2500);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const amountMinor = custom ? Math.round(Number(custom) * 100) : amount;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const body = { charityId: charity.id, amountMinor };
      if (message) body.message = message;
      if (!user && donorName) body.donorName = donorName;
      if (!user && donorEmail) body.donorEmail = donorEmail;
      const result = await api.post('/charities/donate', body);
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        setError(new ApiError('The payment provider did not return a checkout link.'));
      }
    } catch (cause) {
      setError(cause);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Donate to ${charity?.name ?? ''}`}
      description="A one-off gift, independent of your membership and the draw."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="jade" onClick={submit} loading={submitting} disabled={!amountMinor || amountMinor < 100}>
            Continue to payment
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError error={error} />

        <div className="grid grid-cols-4 gap-2">
          {DONATION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setAmount(preset);
                setCustom('');
              }}
              className={`rounded-xl border py-3 text-sm transition-colors ${
                !custom && amount === preset
                  ? 'border-jade-500/60 bg-jade-950 text-jade-400'
                  : 'border-white/10 bg-ink-800/70 text-ivory-faint hover:border-white/25'
              }`}
            >
              {money(preset, { compact: true })}
            </button>
          ))}
        </div>

        <Field label="Or enter another amount" hint="Minimum £1.00">
          <Input
            type="number"
            min="1"
            step="0.5"
            inputMode="decimal"
            value={custom}
            placeholder="0.00"
            onChange={(event) => setCustom(event.target.value)}
          />
        </Field>

        {!user && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name">
              <Input value={donorName} onChange={(event) => setDonorName(event.target.value)} />
            </Field>
            <Field label="Email for the receipt">
              <Input type="email" value={donorEmail} onChange={(event) => setDonorEmail(event.target.value)} />
            </Field>
          </div>
        )}

        <Field label="Message (optional)">
          <Input value={message} maxLength={300} onChange={(event) => setMessage(event.target.value)} />
        </Field>

        <p className="text-xs text-mist-400">
          Payments run through Stripe in test mode for this build. Use card 4242 4242 4242 4242 with any
          future expiry and any CVC.
        </p>
      </div>
    </Modal>
  );
}
