import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WINNER_STATES,
  transition,
  canTransition,
  allowedActions,
  paymentStatusFor,
  PAYMENT_STATUS,
} from '../src/domain/winners/winnerStateMachine.js';

test('the happy path runs proof → review → approve → payout → paid', () => {
  let state = WINNER_STATES.PENDING_PROOF;
  state = transition(state, 'SUBMIT_PROOF');
  assert.equal(state, WINNER_STATES.PROOF_SUBMITTED);
  state = transition(state, 'START_REVIEW');
  assert.equal(state, WINNER_STATES.UNDER_REVIEW);
  state = transition(state, 'APPROVE');
  assert.equal(state, WINNER_STATES.APPROVED);
  state = transition(state, 'QUEUE_PAYOUT');
  assert.equal(state, WINNER_STATES.PAYOUT_PENDING);
  state = transition(state, 'MARK_PAID');
  assert.equal(state, WINNER_STATES.PAID);
});

test('a rejected claim can be re-submitted', () => {
  const rejected = transition(WINNER_STATES.UNDER_REVIEW, 'REJECT');
  assert.equal(rejected, WINNER_STATES.REJECTED);
  assert.equal(transition(rejected, 'SUBMIT_PROOF'), WINNER_STATES.PROOF_SUBMITTED);
});

test('a claim cannot be paid before it is approved', () => {
  assert.throws(() => transition(WINNER_STATES.PROOF_SUBMITTED, 'MARK_PAID'), {
    code: 'INVALID_WINNER_TRANSITION',
  });
  assert.throws(() => transition(WINNER_STATES.PENDING_PROOF, 'APPROVE'), {
    code: 'INVALID_WINNER_TRANSITION',
  });
});

test('a paid claim is terminal', () => {
  assert.deepEqual(allowedActions(WINNER_STATES.PAID), []);
  assert.throws(() => transition(WINNER_STATES.PAID, 'REJECT'), { code: 'INVALID_WINNER_TRANSITION' });
});

test('payment status is pending until the payout is marked complete', () => {
  assert.equal(paymentStatusFor(WINNER_STATES.APPROVED), PAYMENT_STATUS.PENDING);
  assert.equal(paymentStatusFor(WINNER_STATES.PAYOUT_PENDING), PAYMENT_STATUS.PENDING);
  assert.equal(paymentStatusFor(WINNER_STATES.PAID), PAYMENT_STATUS.PAID);
});

test('canTransition mirrors transition without throwing', () => {
  assert.equal(canTransition(WINNER_STATES.APPROVED, 'QUEUE_PAYOUT'), true);
  assert.equal(canTransition(WINNER_STATES.APPROVED, 'MARK_PAID'), false);
});
