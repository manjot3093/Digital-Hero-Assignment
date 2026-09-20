import userRepository from '../repositories/userRepository.js';
import scoreRepository from '../repositories/scoreRepository.js';
import charityRepository from '../repositories/charityRepository.js';
import drawRepository from '../repositories/drawRepository.js';
import donationRepository from '../repositories/donationRepository.js';
import subscriptionService from './subscriptionService.js';
import drawService from './drawService.js';
import winnerService from './winnerService.js';
import { summarise } from '../domain/scores/scoreRules.js';
import { splitContribution } from '../domain/charity/contribution.js';
import { MAX_RETAINED } from '../domain/scores/scoreRules.js';

/** Assembles everything the subscriber dashboard needs in one round trip. */
export const dashboardService = {
  async forUser(userId) {
    const [user, scoreRows, subscriptionState, current, winnings, entries, donations] = await Promise.all([
      userRepository.findById(userId),
      scoreRepository.listByUser(userId),
      subscriptionService.forUser(userId),
      drawService.current(),
      winnerService.summaryForUser(userId),
      drawRepository.entriesForUser(userId),
      donationRepository.listByUser(userId),
    ]);

    const scores = scoreRows.map((row) => ({
      id: row.id,
      value: row.value,
      playedOn: row.played_on,
      courseName: row.course_name,
      createdAt: row.created_at,
    }));

    const charity = user.charity_id ? await charityRepository.findById(user.charity_id) : null;
    const plan = subscriptionState.subscription;
    const contribution = plan
      ? splitContribution({ amountMinor: plan.amount_minor, charityPercent: user.charity_percent })
      : null;

    const myEntry = current ? entries.find((entry) => entry.draw_id === current.draw.id) ?? null : null;

    return {
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        homeClub: user.home_club,
        handicap: user.handicap,
      },
      subscription: {
        status: subscriptionState.status,
        entitled: subscriptionState.entitled,
        plan: plan ? { code: plan.plan_code, name: plan.plan_name, interval: plan.interval, amountMinor: plan.amount_minor, currency: plan.currency } : null,
        renewsOn: plan?.current_period_end ?? null,
        cancelAtPeriodEnd: plan?.cancel_at_period_end ?? false,
      },
      charity: charity
        ? {
            id: charity.id,
            name: charity.name,
            slug: charity.slug,
            tagline: charity.tagline,
            logoUrl: charity.logo_url,
            percent: user.charity_percent,
            perPaymentMinor: contribution?.charityMinor ?? null,
          }
        : null,
      scores: {
        items: scores,
        summary: summarise(scores),
        retention: { max: MAX_RETAINED, used: scores.length, remaining: Math.max(0, MAX_RETAINED - scores.length) },
      },
      draw: current
        ? {
            reference: current.draw.reference,
            status: current.draw.status,
            drawAt: current.draw.draw_at,
            entriesCloseAt: current.draw.entries_close_at,
            poolMinor: Number(current.pool?.total_minor ?? current.projected?.totalMinor ?? 0),
            carriedInMinor: Number(current.draw.carried_in_minor ?? 0),
            subscriberCount: Number(current.pool?.subscriber_count ?? current.projected?.subscriberCount ?? 0),
            myNumbers: myEntry?.numbers ?? null,
          }
        : null,
      participation: {
        drawsEntered: entries.length,
        history: entries.slice(0, 6),
      },
      winnings,
      donations: donations.slice(0, 5),
    };
  },
};

export default dashboardService;
