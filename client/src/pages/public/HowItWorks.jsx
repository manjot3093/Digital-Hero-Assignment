import { motion } from 'framer-motion';
import Button from '../../components/ui/Button.jsx';
import { Eyebrow, GlassPanel, SectionHeading } from '../../components/ui/Panel.jsx';
import Reveal from '../../components/ui/Reveal.jsx';

/**
 * A vertical spine with the six stages hung off it. The numbers here are
 * genuinely sequential — this is a process you move through in order — which
 * is the only reason the steps are numbered at all.
 */
const STAGES = [
  {
    title: 'Subscribe',
    accent: 'coral',
    body:
      'Pick monthly or yearly and pay through Stripe. Your membership status is checked against the payment provider on every request, so nothing depends on what the browser claims.',
    detail: ['Monthly or yearly billing', 'Cancel any time from your dashboard', 'Lapsed members keep read access'],
  },
  {
    title: 'Choose your cause',
    accent: 'jade',
    body:
      'Browse the directory and select a charity. Set the share of your subscription that goes to it — the floor is 10%, the ceiling is everything.',
    detail: ['10% minimum, enforced in the database', 'Raise or lower it at any time', 'Switch charity whenever you like'],
  },
  {
    title: 'Log your scores',
    accent: 'ivory',
    body:
      'Enter your Stableford points with the date you played. One entry per date. We retain your latest five: log a sixth and the oldest drops off automatically.',
    detail: ['Score range 1–45', 'One score per date', 'Newest first, always five or fewer'],
  },
  {
    title: 'Get your ticket',
    accent: 'ivory',
    body:
      'Your retained scores map onto the 40-ball pool to form your five numbers. The mapping is deterministic, so the ticket you can see is the ticket that plays.',
    detail: ['Five numbers from a pool of forty', 'Rebuilt when your scores change', 'Visible on your dashboard before the draw'],
  },
  {
    title: 'The monthly draw',
    accent: 'gold',
    body:
      'An administrator simulates the draw first, reviews the outcome, and only then publishes it. Publishing writes the results, the prize tiers and the winners in a single database transaction.',
    detail: ['Random or score-weighted selection', 'Simulation commits nothing', 'Published results are permanent'],
  },
  {
    title: 'Claim your win',
    accent: 'gold',
    body:
      'Match three, four or five numbers and you take a share of that tier. Upload a screenshot of your scores as proof, an administrator reviews it, and your payout moves from pending to paid.',
    detail: ['40% / 35% / 25% across the tiers', 'Tier split equally between winners', 'Five-match jackpot rolls over if unclaimed'],
  },
];

const ACCENTS = {
  coral: 'border-coral-500/40 text-coral-400',
  jade: 'border-jade-500/40 text-jade-400',
  gold: 'border-gold-500/40 text-gold-400',
  ivory: 'border-white/15 text-ivory-dim',
};

export default function HowItWorks() {
  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-5 pb-12 pt-16 sm:px-8 lg:pt-24">
        <div className="max-w-3xl">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-5 text-display text-ivory">
            Six stages,
            <br />
            one month.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ivory-dim">
            From the moment you subscribe to the moment a payout lands, here is exactly what happens and
            where the rules are enforced.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-16 sm:px-8">
        <ol className="relative">
          {/* The spine. Hidden on phones, where the cards stack tightly anyway. */}
          <span
            aria-hidden="true"
            className="absolute left-[1.45rem] top-4 hidden h-[calc(100%-2rem)] w-px bg-gradient-to-b from-coral-500/50 via-jade-500/40 to-gold-500/50 sm:block"
          />

          {STAGES.map((stage, index) => (
            <Reveal key={stage.title} delay={index * 0.05}>
              <li className="relative mb-4 sm:pl-16">
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-5 hidden h-12 w-12 place-items-center rounded-full border bg-ink-900 font-display text-sm font-semibold sm:grid ${ACCENTS[stage.accent]}`}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="rounded-panel border border-white/[0.08] bg-ink-700/55 p-6 sm:p-7">
                  <h2 className="font-display text-xl font-semibold text-ivory">
                    <span className="mr-3 font-mono text-sm text-mist-400 sm:hidden">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {stage.title}
                  </h2>
                  <p className="mt-3 max-w-2xl leading-relaxed text-ivory-faint">{stage.body}</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {stage.detail.map((item) => (
                      <li
                        key={item}
                        className="rounded-full border border-white/[0.09] bg-ink-800/70 px-3 py-1.5 text-xs text-ivory-faint"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Prize mechanics */}
      <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        <SectionHeading
          eyebrow="The maths"
          title="How a prize pool is divided"
          lead="The pool is recalculated from live subscription revenue before every draw. No figure on this page is fixed in code."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {[
            {
              tier: '5 numbers',
              share: '40%',
              tone: 'border-gold-500/35 bg-gold-950/25',
              text: 'text-gold-400',
              note: 'The jackpot. If nobody matches all five, the whole tier carries into next month on top of the new pool.',
            },
            {
              tier: '4 numbers',
              share: '35%',
              tone: 'border-coral-500/30 bg-coral-950/20',
              text: 'text-coral-400',
              note: 'Does not roll over. Split equally between everyone who matches four.',
            },
            {
              tier: '3 numbers',
              share: '25%',
              tone: 'border-jade-500/30 bg-jade-950/25',
              text: 'text-jade-400',
              note: 'Does not roll over. The widest tier, and usually the one with the most winners.',
            },
          ].map((tier) => (
            <motion.div
              key={tier.tier}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.25 }}
              className={`rounded-panel border p-7 ${tier.tone}`}
            >
              <p className="eyebrow">{tier.tier} matched</p>
              <p className={`mt-4 font-display text-5xl font-semibold ${tier.text}`}>{tier.share}</p>
              <p className="mt-4 text-sm leading-relaxed text-ivory-faint">{tier.note}</p>
            </motion.div>
          ))}
        </div>

        <GlassPanel className="mt-6 p-7">
          <h3 className="font-display text-lg font-semibold text-ivory">Worked example</h3>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ivory-faint">
            Say the pool for a month comes to £4,000 and £1,600 of jackpot has rolled in from the previous
            draw, giving £5,600 to allocate. The five-match tier is £2,240, the four-match tier £1,960 and
            the three-match tier £1,400. If two members match four numbers, they take £980 each. If nobody
            matches five, that £2,240 is carried forward and next month&apos;s jackpot starts there.
          </p>
        </GlassPanel>
      </section>

      <section className="mx-auto w-full max-w-4xl px-5 pb-8 text-center sm:px-8">
        <h2 className="text-headline text-ivory">Ready when you are.</h2>
        <p className="mx-auto mt-4 max-w-lg text-ivory-faint">
          Create an account, choose a cause, and log your first score in about two minutes.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to="/register" size="lg">Start your membership</Button>
          <Button to="/pricing" variant="outline" size="lg">Compare the plans</Button>
        </div>
      </section>
    </>
  );
}
