import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.DISABLE_JOBS = 'true';
process.env.JWT_SECRET = 'test-secret-for-authorisation-tests';

const { createApp } = await import('../src/app.js');
const { requireRole } = await import('../src/middleware/authenticate.js');
const app = createApp();

/** Calls the requireRole middleware directly and reports what it did. */
function runRequireRole(user, roles) {
  return new Promise((resolve) => {
    const req = { user };
    requireRole(...roles)(req, {}, (error) => resolve(error ?? null));
  });
}

test('public visitor: open routes do not require a token', async () => {
  const response = await request(app).get('/api/subscription/plans');
  // 200 with a database, 5xx without one — what matters is that it is not a 401.
  assert.notEqual(response.status, 401);
});

test('public visitor: subscriber routes reject an anonymous request', async () => {
  for (const path of ['/api/scores', '/api/dashboard', '/api/winners/me', '/api/users/me']) {
    const response = await request(app).get(path);
    assert.equal(response.status, 401, `${path} must require authentication`);
    assert.equal(response.body.success, false);
    assert.equal(response.body.code, 'UNAUTHENTICATED');
  }
});

test('public visitor: every admin route rejects an anonymous request', async () => {
  for (const path of ['/api/admin/overview', '/api/admin/users', '/api/admin/draws', '/api/admin/winners', '/api/admin/reports']) {
    const response = await request(app).get(path);
    assert.equal(response.status, 401, `${path} must require authentication`);
  }
});

test('a forged token is rejected', async () => {
  const response = await request(app)
    .get('/api/dashboard')
    .set('Authorization', 'Bearer not.a.real.token');
  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'INVALID_TOKEN');
});

test('subscriber: cannot reach an admin-only handler', async () => {
  const error = await runRequireRole({ id: 'u1', role: 'subscriber' }, ['admin']);
  assert.equal(error.status, 403);
  assert.equal(error.code, 'INSUFFICIENT_ROLE');
});

test('admin: passes the admin role gate', async () => {
  assert.equal(await runRequireRole({ id: 'u2', role: 'admin' }, ['admin']), null);
});

test('role gate rejects an unauthenticated request before checking the role', async () => {
  const error = await runRequireRole(undefined, ['admin']);
  assert.equal(error.status, 401);
});

test('unknown routes return a structured 404, never an HTML stack trace', async () => {
  const response = await request(app).get('/api/nope');
  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, 'ROUTE_NOT_FOUND');
  assert.ok(!('stack' in response.body));
});

test('validation failures return field-level errors, not a 500', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ email: 'not-an-email', password: 'short', firstName: '', lastName: '' });
  assert.equal(response.status, 422);
  assert.equal(response.body.code, 'VALIDATION_FAILED');
  assert.ok(response.body.errors.length > 0);
  assert.ok(response.body.errors.every((e) => e.field && e.message));
});

test('the webhook route refuses an unsigned payload', async () => {
  const response = await request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .send({ type: 'invoice.payment_succeeded' });
  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'MISSING_SIGNATURE');
});

test('an error response never leaks a stack trace or SQL', async () => {
  const response = await request(app).get('/api/scores');
  const body = JSON.stringify(response.body).toLowerCase();
  assert.ok(!body.includes('select '));
  assert.ok(!body.includes('at object.'));
  assert.deepEqual(Object.keys(response.body).sort(), ['code', 'errors', 'message', 'success']);
});
