/**
 * Winner verification state machine (PRD §09).
 *
 *   PENDING_PROOF → PROOF_SUBMITTED → UNDER_REVIEW → APPROVED → PAYOUT_PENDING → PAID
 *                                                   ↘ REJECTED → (re-submit) PROOF_SUBMITTED
 *
 * Modelling this explicitly — instead of a scatter of boolean flags — means an
 * invalid transition is impossible to request rather than merely unlikely.
 */
export const WINNER_STATES = Object.freeze({
  PENDING_PROOF: 'PENDING_PROOF',
  PROOF_SUBMITTED: 'PROOF_SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAYOUT_PENDING: 'PAYOUT_PENDING',
  PAID: 'PAID',
});

export const WINNER_TRANSITIONS = Object.freeze({
  PENDING_PROOF: { SUBMIT_PROOF: WINNER_STATES.PROOF_SUBMITTED },
  PROOF_SUBMITTED: {
    START_REVIEW: WINNER_STATES.UNDER_REVIEW,
    APPROVE: WINNER_STATES.APPROVED,
    REJECT: WINNER_STATES.REJECTED,
    SUBMIT_PROOF: WINNER_STATES.PROOF_SUBMITTED,
  },
  UNDER_REVIEW: {
    APPROVE: WINNER_STATES.APPROVED,
    REJECT: WINNER_STATES.REJECTED,
  },
  APPROVED: { QUEUE_PAYOUT: WINNER_STATES.PAYOUT_PENDING },
  REJECTED: { SUBMIT_PROOF: WINNER_STATES.PROOF_SUBMITTED },
  PAYOUT_PENDING: { MARK_PAID: WINNER_STATES.PAID },
  PAID: {},
});

/** Payment status surfaced to subscribers: Pending → Paid. */
export const PAYMENT_STATUS = Object.freeze({ PENDING: 'pending', PAID: 'paid' });

export class WinnerStateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WinnerStateError';
    this.code = code;
  }
}

export function canTransition(state, action) {
  return Boolean(WINNER_TRANSITIONS[state]?.[action]);
}

export function transition(state, action) {
  const next = WINNER_TRANSITIONS[state]?.[action];
  if (!next) {
    throw new WinnerStateError(
      'INVALID_WINNER_TRANSITION',
      `Cannot ${action.toLowerCase().replace(/_/g, ' ')} a claim that is ${humanise(state)}.`
    );
  }
  return next;
}

export function allowedActions(state) {
  return Object.keys(WINNER_TRANSITIONS[state] ?? {});
}

export function paymentStatusFor(state) {
  return state === WINNER_STATES.PAID ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING;
}

export function humanise(state) {
  return String(state).toLowerCase().replace(/_/g, ' ');
}
