import userRepository from '../repositories/userRepository.js';
import subscriptionRepository from '../repositories/subscriptionRepository.js';
import charityRepository from '../repositories/charityRepository.js';
import drawRepository from '../repositories/drawRepository.js';
import winnerRepository from '../repositories/winnerRepository.js';
import scoreRepository from '../repositories/scoreRepository.js';
import donationRepository from '../repositories/donationRepository.js';
import drawService from './drawService.js';

/**
 * Every figure here comes from a query. Nothing is invented client-side — the
 * admin charts render exactly what the database holds.
 */
export const reportService = {
  async overview() {
    const [roleCounts, plans, charityTotals, donationTotals, winnerStats, current, recentWinners] =
      await Promise.all([
        userRepository.countByRole(),
        subscriptionRepository.planDistribution(),
        charityRepository.totals(),
        donationRepository.totals(),
        winnerRepository.stats(),
        drawService.current(),
        winnerRepository.recent(6),
      ]);

    const entitled = await subscriptionRepository.listEntitled();
    const projected = current ? await drawService.projectPool(current.draw.id, current.draw.carried_in_minor) : null;

    return {
      users: {
        total: roleCounts.reduce((sum, row) => sum + Number(row.count), 0),
        byRole: Object.fromEntries(roleCounts.map((row) => [row.role, Number(row.count)])),
      },
      subscriptions: {
        activeCount: entitled.length,
        planDistribution: plans.map((p) => ({ code: p.code, name: p.name, count: Number(p.count) })),
      },
      prizePool: {
        currentMinor: Number(current?.pool?.total_minor ?? projected?.totalMinor ?? 0),
        carriedInMinor: Number(current?.draw?.carried_in_minor ?? 0),
        drawReference: current?.draw?.reference ?? null,
        drawAt: current?.draw?.draw_at ?? null,
        drawStatus: current?.draw?.status ?? null,
      },
      charity: {
        subscriptionMinor: Number(charityTotals.total_minor),
        donationMinor: Number(donationTotals.total_minor),
        totalMinor: Number(charityTotals.total_minor) + Number(donationTotals.total_minor),
        charitiesSupported: Number(charityTotals.charities_supported),
        contributors: Number(charityTotals.contributors),
      },
      winners: {
        total: Number(winnerStats.total_winners),
        pendingVerification: Number(winnerStats.pending_verification),
        awaitingProof: Number(winnerStats.awaiting_proof),
        paidCount: Number(winnerStats.paid_count),
        paidMinor: Number(winnerStats.paid_minor),
        outstandingMinor: Number(winnerStats.outstanding_minor),
        recent: recentWinners,
      },
    };
  },

  async charts() {
    const [growth, contributions, poolHistory, distribution, planSplit, scoreSpread, topCharities] =
      await Promise.all([
        userRepository.growthByMonth(12),
        charityRepository.contributionsByMonth(12),
        drawRepository.poolHistory(12),
        drawRepository.winnerDistribution(),
        subscriptionRepository.planDistribution(),
        scoreRepository.distribution(),
        charityRepository.topCharities(6),
      ]);

    return {
      subscriberGrowth: cumulative(growth.map((r) => ({ month: r.month, signups: Number(r.signups) }))),
      charityContributions: contributions.map((r) => ({ month: r.month, amountMinor: Number(r.amount_minor) })),
      prizePoolHistory: poolHistory.map((r) => ({
        month: r.month,
        reference: r.reference,
        totalMinor: Number(r.total_minor),
        entryCount: Number(r.entry_count),
      })),
      drawParticipation: poolHistory.map((r) => ({
        month: r.month,
        entries: Number(r.entry_count),
        subscribers: Number(r.subscriber_count),
      })),
      winnerDistribution: distribution.map((r) => ({
        matchCount: r.match_count,
        count: Number(r.count),
        amountMinor: Number(r.amount_minor),
      })),
      planDistribution: planSplit.map((r) => ({ code: r.code, name: r.name, count: Number(r.count) })),
      scoreDistribution: scoreSpread.map((r) => ({
        bucket: `${r.min_value}–${r.max_value}`,
        count: Number(r.count),
      })),
      topCharities: topCharities.map((r) => ({ name: r.name, amountMinor: Number(r.amount_minor) })),
    };
  },

  /** Headline numbers for the public homepage. */
  async publicStats() {
    const [charityTotals, donationTotals, entitled, winnerStats, current, drawCount] = await Promise.all([
      charityRepository.totals(),
      donationRepository.totals(),
      subscriptionRepository.listEntitled(),
      winnerRepository.stats(),
      drawService.current(),
      drawRepository.list({ status: 'published', limit: 100 }),
    ]);

    return {
      charityRaisedMinor: Number(charityTotals.total_minor) + Number(donationTotals.total_minor),
      charitiesSupported: Number(charityTotals.charities_supported),
      memberCount: entitled.length,
      drawsRun: drawCount.length,
      paidOutMinor: Number(winnerStats.paid_minor),
      winnerCount: Number(winnerStats.total_winners),
      nextDraw: current
        ? {
            reference: current.draw.reference,
            drawAt: current.draw.draw_at,
            poolMinor: Number(current.pool?.total_minor ?? current.projected?.totalMinor ?? 0),
          }
        : null,
    };
  },
};

function cumulative(rows) {
  let running = 0;
  return rows.map((row) => {
    running += row.signups;
    return { month: row.month, signups: row.signups, total: running };
  });
}

export default reportService;
