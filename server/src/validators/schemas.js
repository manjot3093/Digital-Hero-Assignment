import { z } from 'zod';
import { MIN_SCORE, MAX_SCORE } from '../domain/scores/scoreRules.js';
import { MIN_CHARITY_PERCENT, MAX_CHARITY_PERCENT } from '../domain/charity/contribution.js';

export const uuid = z.string().uuid('That identifier is not valid.');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format YYYY-MM-DD.');

const password = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128, 'That password is too long.')
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/[0-9]/, 'Include a number.');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password,
  firstName: z.string().trim().min(1, 'Enter your first name.').max(80),
  lastName: z.string().trim().min(1, 'Enter your last name.').max(80),
  homeClub: z.string().trim().max(120).optional().nullable(),
  handicap: z.coerce.number().min(-10).max(54).optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: password,
});

export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  homeClub: z.string().trim().max(120).optional().nullable(),
  handicap: z.coerce.number().min(-10).max(54).optional().nullable(),
});

export const scoreSchema = z.object({
  value: z.coerce
    .number()
    .int('Stableford points must be a whole number.')
    .min(MIN_SCORE, `Points start at ${MIN_SCORE}.`)
    .max(MAX_SCORE, `Points top out at ${MAX_SCORE}.`),
  playedOn: isoDate,
  courseName: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(400).optional().nullable(),
});

export const scoreUpdateSchema = scoreSchema.partial().extend({
  value: scoreSchema.shape.value.optional(),
  playedOn: isoDate.optional(),
});

export const charitySelectionSchema = z.object({
  charityId: uuid,
  charityPercent: z.coerce
    .number()
    .int('Use a whole percentage.')
    .min(MIN_CHARITY_PERCENT, `The minimum is ${MIN_CHARITY_PERCENT}%.`)
    .max(MAX_CHARITY_PERCENT, `The maximum is ${MAX_CHARITY_PERCENT}%.`),
});

export const donationSchema = z.object({
  charityId: uuid,
  amountMinor: z.coerce.number().int().min(100, 'The smallest donation we can take is £1.00.').max(1_000_000),
  donorName: z.string().trim().max(120).optional(),
  donorEmail: z.string().trim().email().optional(),
  message: z.string().trim().max(300).optional(),
});

export const checkoutSchema = z.object({
  planCode: z.enum(['monthly', 'yearly'], { errorMap: () => ({ message: 'Choose the monthly or yearly plan.' }) }),
});

export const charityQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  category: z.string().trim().max(60).optional(),
  featured: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(60).optional().default(24),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  search: z.string().trim().max(120).optional().default(''),
  status: z.string().trim().max(40).optional(),
  state: z.string().trim().max(40).optional(),
  role: z.enum(['subscriber', 'admin']).optional(),
});

export const drawCreateSchema = z.object({
  periodMonth: isoDate.optional(),
  strategy: z.enum(['random', 'weighted']).optional().default('random'),
});

export const drawConfigureSchema = z.object({
  strategy: z.enum(['random', 'weighted']).optional(),
  entriesCloseAt: z.string().datetime().optional(),
  drawAt: z.string().datetime().optional(),
});

export const drawSimulateSchema = z.object({
  strategy: z.enum(['random', 'weighted']).optional(),
  seed: z.string().trim().min(1).max(80).optional(),
});

export const drawPublishSchema = z.object({
  seed: z.string().trim().min(1).max(80).optional(),
  strategy: z.enum(['random', 'weighted']).optional(),
  confirm: z.literal(true, { errorMap: () => ({ message: 'Confirm that you want to publish this draw.' }) }),
});

export const winnerReviewSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export const winnerRejectSchema = z.object({
  notes: z.string().trim().min(5, 'Explain why the proof was rejected.').max(500),
});

export const payoutSchema = z.object({
  reference: z.string().trim().max(80).optional(),
  method: z.enum(['bank_transfer', 'cheque', 'account_credit']).optional().default('bank_transfer'),
});

export const charityAdminSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens.').max(80),
  name: z.string().trim().min(2).max(120),
  tagline: z.string().trim().max(160).optional().nullable(),
  description: z.string().trim().min(20, 'Write at least a short paragraph.').max(4000),
  category: z.string().trim().min(2).max(60),
  region: z.string().trim().max(60).optional(),
  heroImageUrl: z.string().url().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),
  impactHeadline: z.string().trim().max(160).optional().nullable(),
  impactMetrics: z.array(z.object({ label: z.string().max(60), value: z.string().max(40) })).max(6).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const charityEventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(600).optional(),
  venue: z.string().trim().max(120).optional(),
  startsAt: z.string().datetime(),
});

export const userStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});
