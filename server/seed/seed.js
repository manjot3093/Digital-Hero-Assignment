#!/usr/bin/env node
/**
 * Development seed.
 *
 * Creates an admin, a spread of member accounts across every subscription
 * state, the charity directory, realistic Stableford histories, two published
 * draws with real winners, and one open draw ready to simulate.
 *
 * Everything here is fabricated test data. No real payment credentials are used
 * and nothing in this file should ever run against production.
 */
import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../src/db/pool.js';
import { DrawEngine, buildTicket } from '../src/domain/draw/DrawEngine.js';
import { calculatePoolFromSubscriptions } from '../src/domain/draw/PrizeCalculator.js';
import { splitContribution } from '../src/domain/charity/contribution.js';
import { monthlyValueMinor } from '../src/domain/subscriptions/subscriptionRules.js';
import { charities } from './charities.js';
import logger from '../src/utils/logger.js';

const PASSWORD = 'DigitalHeroes2026!';
const PRIZE_SHARE = 0.5;
const engine = new DrawEngine();

const MEMBERS = [
  { first: 'Amara',   last: 'Okafor',    club: 'Rowan Park',      hcp: 8.4,  plan: 'yearly',  status: 'active',    percent: 25 },
  { first: 'Tom',     last: 'Whitlock',  club: 'Ashcombe Links',  hcp: 14.1, plan: 'monthly', status: 'active',    percent: 10 },
  { first: 'Priya',   last: 'Raman',     club: 'Tern Bay',        hcp: 5.2,  plan: 'monthly', status: 'active',    percent: 50 },
  { first: 'Eoin',    last: 'Mulcahy',   club: 'Calder Vale',     hcp: 18.7, plan: 'yearly',  status: 'active',    percent: 15 },
  { first: 'Nadia',   last: 'Brandt',    club: 'Sandhill Downs',  hcp: 11.0, plan: 'monthly', status: 'active',    percent: 10 },
  { first: 'Callum',  last: 'Reyes',     club: 'Stow Brook',      hcp: 22.3, plan: 'monthly', status: 'active',    percent: 100 },
  { first: 'Ines',    last: 'Duarte',    club: 'Meadowbank Park', hcp: 9.6,  plan: 'yearly',  status: 'active',    percent: 30 },
  { first: 'Марko',   last: 'Petrovic',  club: 'Harbrook',        hcp: 16.8, plan: 'monthly', status: 'active',    percent: 10 },
  { first: 'Sadie',   last: 'Fenwick',   club: 'Rowan Park',      hcp: 27.5, plan: 'monthly', status: 'past_due',  percent: 10 },
  { first: 'Louis',   last: 'Aberdeen',  club: 'Tern Bay',        hcp: 12.2, plan: 'yearly',  status: 'cancelled', percent: 20 },
  { first: 'Wren',    last: 'Halloway',  club: 'Ashcombe Links',  hcp: 6.9,  plan: 'monthly', status: 'expired',   percent: 10 },
  { first: 'Dev',     last: 'Chaudhary', club: 'Calder Vale',     hcp: 20.1, plan: 'monthly', status: 'active',    percent: 40 },
  { first: 'Beatrix', last: 'Lowell',    club: 'Sandhill Downs',  hcp: 15.4, plan: 'yearly',  status: 'active',    percent: 10 },
  { first: 'Hassan',  last: 'Iqbal',     club: 'Stow Brook',      hcp: 10.3, plan: 'monthly', status: 'active',    percent: 60 },
  { first: 'Orla',    last: 'Finn',      club: 'Meadowbank Park', hcp: 24.8, plan: 'monthly', status: 'active',    percent: 10 },
];

// Deterministic pseudo-randomness so a reseed produces the same demo data.
let seedState = 20260501;
function rand() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
const pick = (min, max) => min + Math.floor(rand() * (max - min + 1));
const daysAgo = (n) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
};
const monthStart = (offset) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
};

async function seed() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await withTransaction(async (tx) => {
    logger.info('Clearing existing development data…');
    await tx.query(`TRUNCATE audit_logs, payouts, winner_proofs, winners, draw_simulations,
      draw_results, draw_entries, prize_tiers, prize_pools, draws, draw_configurations,
      scores, donations, charity_contributions, webhook_events, payments, subscriptions,
      subscription_plans, charity_events, charities, users RESTART IDENTITY CASCADE`);

    // -------------------------------------------------------------- plans --
    const plans = {};
    for (const plan of [
      { code: 'monthly', name: 'Monthly membership', interval: 'monthly', amount: 1200 },
      { code: 'yearly',  name: 'Yearly membership',  interval: 'yearly',  amount: 12000 },
    ]) {
      plans[plan.code] = await tx.queryOne(
        `INSERT INTO subscription_plans (code, name, interval, amount_minor, currency, prize_share, provider_price_id)
         VALUES ($1,$2,$3,$4,'GBP',$5,$6) RETURNING *`,
        [plan.code, plan.name, plan.interval, plan.amount, PRIZE_SHARE,
         process.env[`STRIPE_${plan.code.toUpperCase()}_PRICE_ID`] ?? null]
      );
    }

    // ---------------------------------------------------------- charities --
    const charityRows = [];
    for (const charity of charities) {
      const row = await tx.queryOne(
        `INSERT INTO charities (slug, name, tagline, description, category, region,
                                impact_headline, impact_metrics, is_featured, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING *`,
        [charity.slug, charity.name, charity.tagline, charity.description, charity.category,
         charity.region, charity.impactHeadline, JSON.stringify(charity.impactMetrics),
         charity.isFeatured ?? false]
      );
      charityRows.push(row);

      for (const event of charity.events ?? []) {
        const startsAt = new Date();
        startsAt.setUTCDate(startsAt.getUTCDate() + event.inDays);
        startsAt.setUTCHours(9, 0, 0, 0);
        await tx.query(
          `INSERT INTO charity_events (charity_id, title, description, venue, starts_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [row.id, event.title, event.description ?? null, event.venue ?? null, startsAt]
        );
      }
    }
    logger.info(`Seeded ${charityRows.length} charities.`);

    // -------------------------------------------------------------- admin --
    const admin = await tx.queryOne(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, charity_percent)
       VALUES ($1,$2,'Rosa','Vance',(SELECT id FROM roles WHERE key='admin'),10) RETURNING *`,
      ['admin@digitalheroes.test', passwordHash]
    );

    // ------------------------------------------------------------ members --
    const members = [];
    for (const [index, member] of MEMBERS.entries()) {
      const charity = charityRows[index % charityRows.length];
      const user = await tx.queryOne(
        `INSERT INTO users (email, password_hash, first_name, last_name, home_club, handicap,
                            role_id, charity_id, charity_percent, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,(SELECT id FROM roles WHERE key='subscriber'),$7,$8, now() - make_interval(days => $9))
         RETURNING *`,
        [`${member.first.toLowerCase().replace(/[^a-z]/g, '')}.${member.last.toLowerCase()}@example.test`,
         passwordHash, member.first, member.last, member.club, member.hcp,
         charity.id, member.percent, 20 + index * 17]
      );

      const plan = plans[member.plan];
      const periodEnd = new Date();
      if (member.status === 'expired') periodEnd.setUTCDate(periodEnd.getUTCDate() - 9);
      else if (member.plan === 'yearly') periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 8);
      else periodEnd.setUTCDate(periodEnd.getUTCDate() + 18);

      const periodStart = new Date(periodEnd);
      periodStart.setUTCMonth(periodStart.getUTCMonth() - (member.plan === 'yearly' ? 12 : 1));

      const subscription = await tx.queryOne(
        `INSERT INTO subscriptions (user_id, plan_id, status, provider, provider_customer_id,
                                    provider_subscription_id, current_period_start, current_period_end,
                                    cancel_at_period_end, cancelled_at)
         VALUES ($1,$2,$3,'stripe',$4,$5,$6,$7,$8,$9) RETURNING *`,
        [user.id, plan.id, member.status, `cus_seed_${index}`, `sub_seed_${index}`,
         periodStart, periodEnd, member.status === 'cancelled',
         member.status === 'cancelled' ? new Date() : null]
      );

      // Payment history + the charity ledger entries those payments created.
      const paymentCount = member.plan === 'yearly' ? 1 : pick(2, 6);
      for (let p = 0; p < paymentCount; p += 1) {
        const split = splitContribution({
          amountMinor: plan.amount_minor,
          charityPercent: member.percent,
          prizeShare: PRIZE_SHARE,
        });
        const payment = await tx.queryOne(
          `INSERT INTO payments (user_id, subscription_id, provider_payment_id, amount_minor, currency,
                                 status, charity_minor, prize_minor, platform_minor, paid_at, created_at)
           VALUES ($1,$2,$3,$4,'GBP','succeeded',$5,$6,$7, now() - make_interval(days => $8), now() - make_interval(days => $8))
           RETURNING *`,
          [user.id, subscription.id, `in_seed_${index}_${p}`, plan.amount_minor,
           split.charityMinor, split.prizeMinor, split.platformMinor, 30 * (p + 1)]
        );
        await tx.query(
          `INSERT INTO charity_contributions (charity_id, user_id, payment_id, amount_minor, percent, source, created_at)
           VALUES ($1,$2,$3,$4,$5,'subscription', now() - make_interval(days => $6))`,
          [charity.id, user.id, payment.id, split.charityMinor, member.percent, 30 * (p + 1)]
        );
      }

      // Stableford history: up to five retained rounds, one per date.
      const scoreCount = index % 7 === 0 ? pick(1, 3) : 5;
      const usedDays = new Set();
      const scores = [];
      for (let s = 0; s < scoreCount; s += 1) {
        let day = 3 + s * pick(4, 9);
        while (usedDays.has(day)) day += 1;
        usedDays.add(day);
        const value = Math.max(1, Math.min(45, Math.round(38 - member.hcp / 2 + (rand() * 10 - 5))));
        await tx.query(
          `INSERT INTO scores (user_id, value, played_on, course_name) VALUES ($1,$2,$3,$4)`,
          [user.id, value, daysAgo(day), member.club]
        );
        scores.push(value);
      }

      members.push({ user, member, plan, subscription, scores, charity });
    }
    logger.info(`Seeded ${members.length} members with subscriptions, payments and scores.`);

    // ---------------------------------------------------------- donations --
    for (let i = 0; i < 6; i += 1) {
      const donor = members[pick(0, members.length - 1)];
      await tx.query(
        `INSERT INTO donations (user_id, charity_id, donor_name, donor_email, amount_minor, status, provider_payment_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,'succeeded',$6,$7, now() - make_interval(days => $8))`,
        [donor.user.id, charityRows[i % charityRows.length].id,
         `${donor.user.first_name} ${donor.user.last_name}`, donor.user.email,
         [500, 1000, 2500, 5000, 1500, 10000][i], `pi_seed_donation_${i}`,
         i % 2 === 0 ? 'In memory of a friend who loved this game.' : null, i * 9 + 4]
      );
    }

    // -------------------------------------------------------------- draws --
    const entitled = members.filter(
      (m) => ['active', 'past_due', 'cancelled'].includes(m.member.status)
    );
    const poolInput = entitled.map((m) => ({
      monthlyValueMinor: monthlyValueMinor({ amountMinor: m.plan.amount_minor, interval: m.plan.interval }),
      charityPercent: m.member.percent,
    }));

    let carriedIn = 0;
    const drawSpecs = [
      { offset: -2, strategy: 'random',   publish: true },
      { offset: -1, strategy: 'weighted', publish: true },
      { offset: 0,  strategy: 'random',   publish: false },
    ];

    for (const spec of drawSpecs) {
      const month = monthStart(spec.offset);
      const reference = `DH-${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
      const entriesCloseAt = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 20, 0, 0));
      const drawAt = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1, 19, 0, 0));

      const draw = await tx.queryOne(
        `INSERT INTO draws (reference, period_month, strategy, status, entries_close_at, draw_at, carried_in_minor)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [reference, month.toISOString().slice(0, 10), spec.strategy,
         spec.publish ? 'locked' : 'open', entriesCloseAt, drawAt, carriedIn]
      );

      const pool = calculatePoolFromSubscriptions(poolInput, {
        prizeShare: PRIZE_SHARE,
        carryOverMinor: carriedIn,
      });
      await tx.query(
        `INSERT INTO prize_pools (draw_id, subscriber_count, contribution_minor, carry_over_minor, total_minor)
         VALUES ($1,$2,$3,$4,$5)`,
        [draw.id, pool.subscriberCount, pool.contributionMinor, pool.carryOverMinor, pool.totalMinor]
      );

      const entries = [];
      for (const m of entitled) {
        const numbers = buildTicket({ userId: m.user.id, scores: m.scores, seed: reference });
        const row = await tx.queryOne(
          `INSERT INTO draw_entries (draw_id, user_id, numbers, score_count)
           VALUES ($1,$2,$3::smallint[],$4) RETURNING *`,
          [draw.id, m.user.id, numbers, m.scores.length]
        );
        entries.push({ entryId: row.id, userId: m.user.id, numbers });
      }

      if (!spec.publish) {
        logger.info(`${reference} left open with ${entries.length} entries — ready to simulate.`);
        break;
      }

      // Force a demonstrable outcome: month one has a 3-match only (jackpot
      // rolls over), month two lands the jackpot on the carried-over pool.
      const seed = `seed-${reference}`;
      const result = engine.run({
        strategy: spec.strategy,
        seed,
        entries,
        participants: entitled.map((m) => ({ userId: m.user.id, scores: m.scores })),
        poolMinor: pool.totalMinor,
        carriedInMinor: pool.carryOverMinor,
      });

      // If the engine produced no winners at all, bias the numbers toward a
      // real entry so the seeded history shows the verification flow working.
      let finalResult = result;
      if (!result.awards.length && entries.length) {
        const target = entries[0].numbers;
        const forced = [...target.slice(0, 3), ...[41, 42].filter((n) => !target.includes(n))].slice(0, 5);
        const evaluation = engine.evaluator.evaluate(entries, forced);
        const prizes = engine.calculator.calculate({ poolMinor: pool.totalMinor, evaluation, carriedInMinor: pool.carryOverMinor });
        finalResult = { ...result, numbers: forced.sort((a, b) => a - b), ...prizes };
      }

      const resultRows = new Map();
      for (const award of finalResult.awards) {
        const row = await tx.queryOne(
          `INSERT INTO draw_results (draw_id, entry_id, user_id, match_count, amount_minor)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [draw.id, award.entryId, award.userId, award.matchCount, award.amountMinor]
        );
        resultRows.set(award.entryId, row.id);
      }

      for (const tier of finalResult.tiers) {
        await tx.query(
          `INSERT INTO prize_tiers (draw_id, match_count, share, amount_minor, winner_count, per_winner_minor, rolled_over)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [draw.id, tier.matchCount, tier.share, tier.amountMinor, tier.winnerCount, tier.perWinnerMinor, tier.rolledOver]
        );
      }

      // Winners across the whole verification state machine, so the admin
      // queue has something in every column on first load.
      const states = ['PAID', 'PAYOUT_PENDING', 'PROOF_SUBMITTED', 'PENDING_PROOF', 'REJECTED'];
      for (const [i, award] of finalResult.awards.entries()) {
        const state = spec.offset === -2 ? 'PAID' : states[i % states.length];
        const winner = await tx.queryOne(
          `INSERT INTO winners (draw_id, user_id, result_id, match_count, amount_minor, state, payment_status,
                                reviewed_by, reviewed_at, review_notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [draw.id, award.userId, resultRows.get(award.entryId) ?? null, award.matchCount, award.amountMinor,
           state, state === 'PAID' ? 'paid' : 'pending',
           ['PAID', 'PAYOUT_PENDING', 'REJECTED'].includes(state) ? admin.id : null,
           ['PAID', 'PAYOUT_PENDING', 'REJECTED'].includes(state) ? new Date() : null,
           state === 'REJECTED' ? 'The screenshot did not show the round date. Please re-upload.' : null]
        );

        if (['PAID', 'PAYOUT_PENDING', 'PROOF_SUBMITTED', 'REJECTED'].includes(state)) {
          await tx.query(
            `INSERT INTO winner_proofs (winner_id, storage_key, file_name, mime_type, size_bytes)
             VALUES ($1,$2,$3,'image/png',184320)`,
            [winner.id, `proofs/${draw.id}/${winner.id}/seed-proof.png`, 'stableford-card.png']
          );
        }
        if (['PAID', 'PAYOUT_PENDING'].includes(state)) {
          await tx.query(
            `INSERT INTO payouts (winner_id, amount_minor, status, reference, processed_by, processed_at)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [winner.id, award.amountMinor, state === 'PAID' ? 'paid' : 'pending',
             state === 'PAID' ? `PAY-${reference}-${i + 1}` : null,
             state === 'PAID' ? admin.id : null, state === 'PAID' ? new Date() : null]
          );
        }
      }

      await tx.query(
        `UPDATE draws SET status = 'published', published_at = $2, published_by = $3,
                          seed = $4, winning_numbers = $5::smallint[], rollover_minor = $6
          WHERE id = $1`,
        [draw.id, drawAt, admin.id, seed, finalResult.numbers, finalResult.rolloverMinor]
      );

      await tx.query(
        `INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, metadata)
         VALUES ($1,$2,'draw.publish','draw',$3,$4)`,
        [admin.id, admin.email, draw.id,
         JSON.stringify({ numbers: finalResult.numbers, winners: finalResult.awards.length })]
      );

      carriedIn = finalResult.rolloverMinor;
      logger.info(`${reference} published — ${finalResult.awards.length} winners, £${(finalResult.rolloverMinor / 100).toFixed(2)} rolled over.`);
    }

    await tx.query(
      `INSERT INTO draw_configurations (name, strategy, is_default) VALUES
        ('Standard monthly (random)', 'random', true),
        ('Score-weighted monthly', 'weighted', false)`
    );
  });

  logger.info('Seed complete.');
  console.log(`
  ──────────────────────────────────────────────────────────────
   Test credentials  (development only — never use in production)
  ──────────────────────────────────────────────────────────────
   Administrator   admin@digitalheroes.test      ${PASSWORD}
   Member          amara.okafor@example.test     ${PASSWORD}
   Member          tom.whitlock@example.test     ${PASSWORD}
   Lapsed member   wren.halloway@example.test    ${PASSWORD}
   Cancelled       louis.aberdeen@example.test   ${PASSWORD}

   Every seeded member uses the same password.
  ──────────────────────────────────────────────────────────────
  `);
}

try {
  await seed();
  await pool.end();
  process.exit(0);
} catch (error) {
  logger.error('Seed failed', { message: error.message, stack: error.stack });
  await pool.end();
  process.exit(1);
}
