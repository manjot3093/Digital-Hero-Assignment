import charityRepository from '../repositories/charityRepository.js';
import donationRepository from '../repositories/donationRepository.js';
import userRepository from '../repositories/userRepository.js';
import subscriptionRepository from '../repositories/subscriptionRepository.js';
import {
  assertValidPercent,
  splitContribution,
  annualisedCharityImpact,
  CharityRuleError,
} from '../domain/charity/contribution.js';
import { paymentProvider } from '../integrations/payments/index.js';
import AppError from '../utils/AppError.js';
import env from '../config/env.js';

function wrap(error) {
  if (error instanceof CharityRuleError) {
    return new AppError(error.message, { status: 422, code: error.code });
  }
  return error;
}

export const charityService = {
  async directory(filters) {
    const [{ rows, total }, categories] = await Promise.all([
      charityRepository.list(filters),
      charityRepository.categories(),
    ]);
    return { charities: rows, categories, total };
  },

  async profile(idOrSlug) {
    const charity = await charityRepository.findByIdOrSlug(idOrSlug);
    if (!charity) throw AppError.notFound('That charity is not listed.', 'CHARITY_NOT_FOUND');
    const [events, stats] = await Promise.all([
      charityRepository.events(charity.id),
      charityRepository.stats(charity.id),
    ]);
    return { charity, events, stats };
  },

  /** Selects a cause and sets the contribution percentage (minimum 10%). */
  async selectForUser(userId, { charityId, charityPercent }) {
    try {
      const percent = assertValidPercent(Number(charityPercent));
      const charity = await charityRepository.findById(charityId);
      if (!charity || !charity.is_active) {
        throw AppError.badRequest('That charity is not available to select.', 'CHARITY_NOT_FOUND');
      }
      const updated = await userRepository.setCharity(userId, { charityId, charityPercent: percent });
      const subscription = await subscriptionRepository.findByUser(userId);
      const projection = subscription
        ? splitContribution({ amountMinor: subscription.amount_minor, charityPercent: percent })
        : null;
      return { charity, selection: updated, projection };
    } catch (error) {
      throw wrap(error);
    }
  },

  /** What the current percentage means in money, for the dashboard slider. */
  projectImpact({ amountMinor, charityPercent, interval }) {
    try {
      return {
        ...splitContribution({ amountMinor, charityPercent }),
        annualCharityMinor: annualisedCharityImpact({ amountMinor, charityPercent, interval }),
      };
    } catch (error) {
      throw wrap(error);
    }
  },

  /** Independent donation, deliberately not tied to gameplay (PRD §08.1). */
  async startDonation({ user, charityId, amountMinor, donorName, donorEmail, message }) {
    const charity = await charityRepository.findById(charityId);
    if (!charity || !charity.is_active) {
      throw AppError.badRequest('That charity is not available.', 'CHARITY_NOT_FOUND');
    }
    if (!Number.isInteger(amountMinor) || amountMinor < 100) {
      throw AppError.badRequest('The smallest donation we can take is £1.00.', 'DONATION_TOO_SMALL');
    }

    const session = await paymentProvider().createDonationSession({
      charity,
      amountMinor,
      successUrl: `${env.clientUrl}/charities/${charity.slug}?donation=thanks`,
      cancelUrl: `${env.clientUrl}/charities/${charity.slug}?donation=cancelled`,
      metadata: { userId: user?.id ?? '' },
    });

    await donationRepository.create({
      userId: user?.id ?? null,
      charityId,
      donorName: donorName ?? (user ? `${user.first_name} ${user.last_name}` : null),
      donorEmail: donorEmail ?? user?.email ?? null,
      amountMinor,
      message,
      providerPaymentId: session.paymentId,
      status: 'pending',
    });

    return { checkoutUrl: session.url };
  },

  async impactTotals() {
    const [contributions, donations, top] = await Promise.all([
      charityRepository.totals(),
      donationRepository.totals(),
      charityRepository.topCharities(6),
    ]);
    return {
      subscriptionMinor: Number(contributions.total_minor),
      donationMinor: Number(donations.total_minor),
      totalMinor: Number(contributions.total_minor) + Number(donations.total_minor),
      charitiesSupported: Number(contributions.charities_supported),
      contributors: Number(contributions.contributors),
      topCharities: top,
    };
  },
};

export default charityService;
