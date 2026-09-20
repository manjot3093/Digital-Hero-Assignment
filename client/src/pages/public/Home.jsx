import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { date, money, number } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { GlassPanel, SectionHeading, Eyebrow } from '../../components/ui/Panel.jsx';
import { AnimatedNumber } from '../../components/ui/Stat.jsx';
import Countdown from '../../components/ui/Countdown.jsx';
import { NumberRow } from '../../components/ui/NumberBall.jsx';
import { Badge, Skeleton } from '../../components/ui/Feedback.jsx';
import Reveal from '../../components/ui/Reveal.jsx';

/**
 * The homepage answers four questions above the fold: what this is, what you
 * do, how you win, and who benefits. Every figure below is read from the API —
 * there are no illustrative numbers on this page.
 */
export default function Home() {
  const { data, loading } = useAsync(async () => {
    const [stats, featured, current, plans, recent] = await Promise.all([
      api.get('/stats'),
      api.get('/charities', { query: { featured: true, pageSize: 3 } }),
      api.get('/draws/current'),
      api.get('/subscription/plans'),
      api.get('/draws'),
    ]);
    return { stats, featured, current, plans: plans.plans, recent: recent.draws ?? [] };
  }, []);

  const stats = data?.stats;
  const draw = data?.current?.draw;
  const pool = data?.current?.pool;
  const poolMinor = Number(pool?.total_minor ?? pool?.totalMinor ?? 0);
  const lastPublished = (data?.recent ?? []).find((row) => row.status === 'published');

  return (
    <>
      {/* ---------------------------------------------------------- hero -- */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-28 lg:pt-24">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="eyebrow"
            >
              Membership · golf · giving
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 text-display text-ivory"
            >
              Your round
              <br />
              <span className="text-jade-400">already counts.</span>
              <br />
              Make it count
              <span className="text-coral-500">.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.14 }}
              className="mt-7 max-w-xl text-lg leading-relaxed text-ivory-dim"
            >
              Subscribe monthly or yearly. Log your last five Stableford rounds — those points become your
              ticket into the monthly member draw. At least a tenth of every payment goes straight to a
              charity you choose, and you can push that share as high as you like.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Button to="/register" size="lg">
                Start your membership
              </Button>
              <Button to="/how-it-works" variant="outline" size="lg">
                See how it works
              </Button>
            </motion.div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/[0.07] pt-7">
              {[
                { label: 'Raised for charity', value: stats?.charityRaisedMinor, format: 'money' },
                { label: 'Paid to winners', value: stats?.paidOutMinor, format: 'money' },
                { label: 'Causes supported', value: stats?.charitiesSupported, format: 'number' },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs uppercase tracking-[0.1em] text-ivory-faint">{item.label}</dt>
                  <dd className="mt-2 font-display text-2xl font-semibold text-ivory">
                    {loading ? (
                      <Skeleton className="h-7 w-20" />
                    ) : (
                      <AnimatedNumber value={item.value ?? 0} format={item.format} />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Live draw panel — the one piece of glass in the hero. */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <GlassPanel className="p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Eyebrow>This month&apos;s pool</Eyebrow>
                  <p className="mt-3 font-display text-5xl font-semibold tracking-tight text-gold-400">
                    {loading ? <Skeleton className="h-12 w-40" /> : <AnimatedNumber value={poolMinor} format="money" />}
                  </p>
                  <p className="mt-2 text-sm text-ivory-faint">
                    {draw ? (
                      <>Calculated live from {number(pool?.subscriber_count ?? 0)} paying members</>
                    ) : (
                      'The next draw is being scheduled.'
                    )}
                  </p>
                </div>
                {draw && <Badge status={draw.status}>{draw.status}</Badge>}
              </div>

              <div className="my-6 h-px bg-white/[0.08]" />

              {draw ? (
                <>
                  <Countdown target={draw.entries_close_at ?? draw.draw_at} label="Entries close in" />
                  <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
                    {[
                      { tier: '5 match', share: '40%', tone: 'text-gold-400' },
                      { tier: '4 match', share: '35%', tone: 'text-coral-400' },
                      { tier: '3 match', share: '25%', tone: 'text-jade-400' },
                    ].map((tier) => (
                      <div key={tier.tier} className="rounded-xl border border-white/[0.07] bg-ink-800/70 py-3">
                        <dt className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist-400">
                          {tier.tier}
                        </dt>
                        <dd className={`mt-1 font-display text-lg font-semibold ${tier.tone}`}>{tier.share}</dd>
                      </div>
                    ))}
                  </dl>
                  {Number(draw.carried_in_minor) > 0 && (
                    <p className="mt-5 rounded-xl border border-gold-500/25 bg-gold-950/50 px-4 py-3 text-sm text-gold-400">
                      Includes {money(draw.carried_in_minor)} rolled over — nobody matched five last time.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-ivory-faint">
                  Draws run monthly. As soon as the next one opens it will appear here with a live countdown.
                </p>
              )}

              <Button to="/draws" variant="ghost" size="sm" className="mt-6 w-full">
                View draw history →
              </Button>
            </GlassPanel>
          </motion.div>
        </div>
      </section>

      {/* -------------------------------------------------- how it works -- */}
      <section className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="The loop"
          title="Play. Perform. Give back. Win."
          lead="Four steps, once a month. Nothing about it asks you to change how you play."
          actions={<Button to="/how-it-works" variant="outline" size="sm">Full walkthrough</Button>}
        />

        <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: 'Play',
              title: 'Play your golf',
              body: 'Nothing changes on the course. Play your usual rounds at your usual club.',
              accent: 'border-white/10',
            },
            {
              step: 'Perform',
              title: 'Log five Stableford scores',
              body: 'One score per date, 1 to 45 points. We keep your latest five — a sixth pushes the oldest off.',
              accent: 'border-coral-500/30',
            },
            {
              step: 'Give back',
              title: 'Fund a cause you pick',
              body: 'At least 10% of every payment goes to your chosen charity. Raise it to 100% if you want to.',
              accent: 'border-jade-500/30',
            },
            {
              step: 'Win',
              title: 'Enter the monthly draw',
              body: 'Your retained scores form your ticket. Match three, four or five numbers to take a share.',
              accent: 'border-gold-500/30',
            },
          ].map((item, index) => (
            <Reveal key={item.step} delay={index * 0.06}>
              <li className={`h-full rounded-panel border bg-ink-700/50 p-6 ${item.accent}`}>
                <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-mist-400">{item.step}</p>
                <h3 className="mt-4 font-display text-lg font-semibold text-ivory">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ivory-faint">{item.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ----------------------------------------------- charity impact -- */}
      <section className="border-y border-white/[0.06] bg-jade-950/25">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Eyebrow>Where the money goes</Eyebrow>
            <h2 className="mt-4 text-headline text-ivory">
              Giving isn&apos;t a footnote here. It&apos;s the reason the platform exists.
            </h2>
            <p className="mt-5 max-w-lg leading-relaxed text-ivory-faint">
              Every subscription is split before it reaches us: a minimum tenth to the charity you selected,
              a fixed share to the prize pool, and the remainder to run the platform. You can see the exact
              split for your own plan on the pricing page, and the running total for the whole membership
              right here.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/charities" variant="jade">
                Browse the directory
              </Button>
              <Button to="/pricing" variant="ghost">
                See the allocation
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Total raised', value: stats?.charityRaisedMinor, format: 'money', tone: 'text-jade-400' },
              { label: 'Causes supported', value: stats?.charitiesSupported, format: 'number', tone: 'text-ivory' },
              { label: 'Paying members', value: stats?.memberCount, format: 'number', tone: 'text-ivory' },
              { label: 'Draws completed', value: stats?.drawsRun, format: 'number', tone: 'text-gold-400' },
            ].map((item) => (
              <GlassPanel key={item.label} className="px-5 py-6">
                <p className="eyebrow">{item.label}</p>
                <p className={`mt-3 font-display text-3xl font-semibold ${item.tone}`}>
                  {loading ? <Skeleton className="h-8 w-24" /> : <AnimatedNumber value={item.value ?? 0} format={item.format} />}
                </p>
              </GlassPanel>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------- featured charities -- */}
      <section className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="Spotlight"
          title="Featured causes this month"
          lead="Pick one at signup, change it whenever you like."
          actions={<Button to="/charities" variant="outline" size="sm">All charities</Button>}
        />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-72" />)
            : (data?.featured?.charities ?? []).map((charity, index) => (
                <Reveal key={charity.id} delay={index * 0.07}>
                  <Link
                    to={`/charities/${charity.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-panel border border-white/[0.08] bg-ink-700/60 transition-colors hover:border-jade-500/35"
                  >
                    <div className="relative h-40 overflow-hidden bg-ink-600">
                      {charity.hero_image_url ? (
                        <img
                          src={charity.hero_image_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-jade-950 to-ink-700" />
                      )}
                      <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-ink-900/80 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ivory-dim">
                        {charity.category}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="font-display text-lg font-semibold text-ivory">{charity.name}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-ivory-faint">{charity.tagline}</p>
                      <p className="mt-5 text-sm text-jade-400">
                        {money(charity.raised_minor, { compact: true })} raised · {number(charity.supporter_count)} members
                      </p>
                    </div>
                  </Link>
                </Reveal>
              ))}
        </div>
      </section>

      {/* ------------------------------------------------- latest result -- */}
      {lastPublished && (
        <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
          <GlassPanel className="grid gap-8 p-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <Eyebrow>Last result · {lastPublished.reference}</Eyebrow>
              <h2 className="mt-3 font-display text-2xl font-semibold text-ivory">
                {number(lastPublished.winner_count)} member{Number(lastPublished.winner_count) === 1 ? '' : 's'} shared{' '}
                {money(lastPublished.total_minor, { compact: true })}
              </h2>
              <p className="mt-2 text-sm text-ivory-faint">
                Drawn {date(lastPublished.published_at)} · {number(lastPublished.entry_count)} entries
              </p>
            </div>
            <div className="lg:text-right">
              <p className="eyebrow mb-3">Winning numbers</p>
              <NumberRow numbers={lastPublished.winning_numbers ?? []} animate />
            </div>
          </GlassPanel>
        </section>
      )}

      {/* --------------------------------------------------------- plans -- */}
      <section className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="Membership"
          title="Two plans. Same split."
          lead="Yearly costs less per month. The allocation rules are identical either way."
          actions={<Button to="/pricing" variant="outline" size="sm">Full breakdown</Button>}
        />

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {(data?.plans ?? []).map((plan) => (
            <div
              key={plan.code}
              className={`rounded-panel border p-7 ${
                plan.code === 'yearly' ? 'border-gold-500/35 bg-gold-950/20' : 'border-white/[0.08] bg-ink-700/60'
              }`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-display text-xl font-semibold text-ivory">{plan.name}</h3>
                {plan.code === 'yearly' && <Badge tone="gold">Best value</Badge>}
              </div>
              <p className="mt-5 font-display text-4xl font-semibold text-ivory">
                {money(plan.amount_minor)}
                <span className="ml-1.5 text-base font-normal text-ivory-faint">
                  /{plan.interval === 'year' ? 'year' : 'month'}
                </span>
              </p>
              <ul className="mt-7 space-y-2.5 text-sm text-ivory-faint">
                <li className="flex gap-2.5">
                  <span className="text-jade-400">→</span>
                  {money(plan.allocation.charityMinor)} to your charity at the 10% minimum
                </li>
                <li className="flex gap-2.5">
                  <span className="text-gold-400">→</span>
                  {money(plan.allocation.prizeMinor)} into the member prize pool
                </li>
                <li className="flex gap-2.5">
                  <span className="text-mist-400">→</span>
                  {money(plan.allocation.platformMinor)} runs the platform
                </li>
              </ul>
              <Button to={`/register?plan=${plan.code}`} variant={plan.code === 'yearly' ? 'gold' : 'primary'} className="mt-8 w-full">
                Choose {plan.name.toLowerCase()}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- faq -- */}
      <section className="mx-auto w-full max-w-4xl px-5 py-20 sm:px-8">
        <SectionHeading eyebrow="Questions" title="Before you join" align="center" />
        <div className="mt-10 divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {[
            {
              q: 'Do I need a handicap or a club membership?',
              a: 'No. You need somewhere to play and a Stableford score you can evidence if you win. Your home club and handicap are optional fields on your profile.',
            },
            {
              q: 'How is my draw ticket decided?',
              a: 'Your retained Stableford scores map onto the number pool. If you have fewer than five scores the rest of your ticket is filled deterministically from your account, so your numbers never change between the simulation and the published result.',
            },
            {
              q: 'What happens if nobody matches five numbers?',
              a: 'The 40% jackpot tier rolls into next month. The 4 and 3 tiers do not roll over — any unclaimed amount there returns to the pool float.',
            },
            {
              q: 'Can I raise my charity percentage later?',
              a: 'Yes, any time from your dashboard, up to 100% of your subscription. The 10% floor is enforced in the API and as a database constraint, so it cannot be edited away in the browser.',
            },
            {
              q: 'How do I claim a win?',
              a: 'Upload a screenshot of your scores from your golf platform. An administrator reviews it, and once approved your payout moves from pending to paid. You can follow that in your dashboard.',
            },
            {
              q: 'Can I donate without subscribing?',
              a: 'Yes. Every charity profile has a one-off donation option that is completely separate from the draw.',
            },
          ].map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                <h3 className="font-display text-base font-medium text-ivory">{item.q}</h3>
                <span
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-mist-400 transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ivory-faint">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- cta -- */}
      <section className="mx-auto w-full max-w-7xl px-5 pb-8 sm:px-8">
        <div className="relative overflow-hidden rounded-panel border border-coral-500/25 bg-coral-950/30 px-7 py-14 text-center sm:px-12">
          <Eyebrow className="relative">Join today</Eyebrow>
          <h2 className="relative mt-4 text-headline text-ivory">
            Next month&apos;s draw is already filling up.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-ivory-faint">
            {draw
              ? `Entries for ${draw.reference} close ${date(draw.entries_close_at ?? draw.draw_at)}. Subscribe, log five scores, and you are in.`
              : 'Subscribe, log five scores, and you are in as soon as the next draw opens.'}
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button to="/register" size="lg">
              Create your account
            </Button>
            <Button to="/charities" variant="outline" size="lg">
              Choose a cause first
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
