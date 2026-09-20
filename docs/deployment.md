# Deployment

The application is two deployable units: a static client bundle and a Node API
with a PostgreSQL database. They can sit behind one domain or two.

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer with the `pgcrypto` and `citext` extensions available
- An object store for winner proof images (any S3-compatible bucket), or local
  disk on a host with persistent storage
- A Stripe account in test or live mode

## Environment

Copy `server/.env.example` to `server/.env` and `client/.env.example` to
`client/.env`, then fill them in. The server reads `process.env` in exactly one
place — `server/src/config/env.js` — and in production a missing required
variable throws at boot rather than failing later in a route.

Generate a real secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Variables that must change from their defaults before going live:

| Variable | Why |
| --- | --- |
| `JWT_SECRET` | The development default is published in the example file |
| `DATABASE_URL` | Point at the managed instance; most require `DATABASE_SSL=true` |
| `CLIENT_URL`, `SERVER_URL`, `CORS_ORIGINS` | CORS is an allowlist, not a wildcard |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs | Test keys will not process real payments |
| `STORAGE_*` | Local disk is not durable on most PaaS hosts |
| `NODE_ENV=production` | Enables strict config checks and secure cookies |

## Database

```bash
cd server
npm install
npm run migrate          # apply 001_init.sql
npm run seed             # demo data — do not run against production
```

`npm run migrate:down` rolls back, `npm run db:reset` drops, re-migrates and
re-seeds. The migration runner records what it has applied, so re-running
`migrate` is safe.

## API

```bash
cd server
npm ci --omit=dev
NODE_ENV=production node src/server.js
```

The process handles `SIGTERM` and `SIGINT` by draining connections before
exiting, so a rolling deploy does not cut off in-flight requests. Put it behind
a reverse proxy that terminates TLS; the app sets `trust proxy` so rate limiting
and `req.ip` see the real client address.

Health check for your platform: `GET /api/health`, which also pings the
database.

### Stripe webhook

The webhook route must receive the **raw** body. It is mounted before
`express.json()` in `app.js` — if you add middleware ahead of it, keep that
ordering or signature verification will fail.

Register the endpoint in the Stripe dashboard:

```
https://api.your-domain.com/api/payments/webhook
```

Subscribe to at least: `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.paid`, `invoice.payment_failed`, `payment_intent.succeeded`.

Locally:

```bash
npm run stripe:listen    # stripe listen --forward-to localhost:4000/api/payments/webhook
```

Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`.

Until a webhook arrives, nothing is marked paid. That is deliberate: a user who
closes the tab mid-checkout does not end up with an active subscription.

## Client

```bash
cd client
npm ci
npm run build            # → client/dist
```

Deploy `client/dist` to any static host. Two things the host must do:

1. **SPA fallback** — rewrite unmatched paths to `/index.html`, or deep links
   like `/dashboard/scores` will 404.
2. **API routing** — either proxy `/api` to the API service (in which case
   leave `VITE_API_URL=/api`), or set `VITE_API_URL` to the API's full origin
   and add that origin to `CORS_ORIGINS` on the server.

Same-origin is the better arrangement: the session cookie is `SameSite=Lax`,
which behaves most predictably when the client and API share a domain.

Netlify:

```
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Nginx:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
location /api/ {
  proxy_pass http://127.0.0.1:4000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Object storage

With `STORAGE_DRIVER=local`, files go to `STORAGE_LOCAL_DIR` and are served
through `/api/files` behind an expiring HMAC signature. This is fine for local
development and for a single host with a persistent volume. It is not suitable
for a platform with an ephemeral filesystem or more than one instance.

With `STORAGE_DRIVER=s3`, set `STORAGE_ENDPOINT`, `STORAGE_BUCKET`,
`STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` and `STORAGE_REGION`. Signed URLs
then point straight at the bucket and `/api/files` returns 404 by design. Keep
the bucket private — the application only ever hands out short-lived signed
links. The S3 driver loads `@aws-sdk/client-s3` lazily, so install it in the
server package when you switch.

## Background jobs

`server/src/jobs/scheduler.js` runs hourly inside the API process: expiring
lapsed subscriptions, recalculating the pool, ensuring the next draw exists and
locking draws past their close time.

If you scale to more than one instance, run the scheduler on one of them only
(or move the jobs to a queue). Each job is a plain exported function with no
coupling to the timer, so this is a change of caller, not of logic.

## Pre-launch checklist

- [ ] `JWT_SECRET` replaced with a generated value
- [ ] `NODE_ENV=production`, TLS terminated, secure cookies confirmed
- [ ] `CORS_ORIGINS` limited to the real client origin
- [ ] Migrations applied; seed data **not** loaded
- [ ] At least one admin account created, its password changed from the seed value
- [ ] Stripe live keys and price IDs set, webhook registered and verified
- [ ] Object storage configured and the bucket private
- [ ] `GET /api/health` returning `database: ok` from the deployed environment
- [ ] Automated database backups enabled
- [ ] Scheduler running on exactly one instance
