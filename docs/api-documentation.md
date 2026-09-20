# API documentation

Base URL: `/api`. All responses are JSON.

## Response envelope

Every successful response has the same shape:

```json
{ "success": true, "data": { }, "message": "Score saved." }
```

Paginated endpoints put the collection in `data.items` with `data.pagination`:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": { "page": 1, "pageSize": 25, "total": 62, "pageCount": 3 }
  }
}
```

Failures:

```json
{
  "success": false,
  "message": "Points top out at 45.",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "value", "message": "Points top out at 45." }]
}
```

`errors` is present for validation failures only, and is keyed by form field so
the client can render messages inline. Stack traces and SQL are never included
in a response.

## Status codes

| Code | Meaning here |
| --- | --- |
| 200 / 201 / 204 | Success |
| 400 | Malformed request the schema could not parse |
| 401 | No session, or an invalid/expired token |
| 403 | Authenticated but not permitted — wrong role, or no active subscription |
| 404 | No such record, or not visible to this caller |
| 409 | Conflict — duplicate score date, draw already published, illegal state transition |
| 413 | Upload over the size limit |
| 422 | Valid JSON that broke a business rule |
| 429 | Rate limited |
| 500 | Unexpected — logged server-side with a generic message returned |

## Authentication

Sign-in sets an **httpOnly, SameSite=Lax** cookie (`dh_session`), so the token
is never readable from JavaScript. The same token is also returned in the body
for non-browser clients, which may send it as `Authorization: Bearer <token>`.
Both are accepted. Send browser requests with `credentials: 'include'`.

Role and subscription entitlement are re-derived from the database on every
request, not read from the token.

## Rate limits

| Scope | Limit |
| --- | --- |
| General API | 300 requests / 15 minutes |
| `/auth/login`, `/auth/register`, `/auth/password` | 10 / 15 minutes |
| Checkout and donation | tighter limiter |
| Proof upload | upload limiter |

---

## Public

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | Service and database health |
| GET | `/api/stats` | Homepage figures: charity raised, members, draws run, paid out, next draw |
| GET | `/api/charities` | Directory. Query: `search`, `category`, `featured`, `page`, `pageSize` |
| GET | `/api/charities/impact` | Aggregate giving totals |
| GET | `/api/charities/:id` | Profile by id **or slug**, with events and stats |
| POST | `/api/charities/donate` | One-off donation. Works signed out. Returns `{ checkoutUrl }` |
| GET | `/api/draws` | Draw list |
| GET | `/api/draws/current` | The open or next draw with its projected pool |
| GET | `/api/draws/:id` | Draw detail: tiers, pool, entry count, winners |
| GET | `/api/subscription/plans` | Plans with their charity/prize/platform allocation |
| GET | `/api/files` | Serves a stored object against an expiring HMAC signature (local driver only) |

## Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `email`, `password`, `firstName`, `lastName`, `homeClub?`, `handicap?` | Password: 10+ chars, upper, lower, digit |
| POST | `/api/auth/login` | `email`, `password` | Deliberately identical error for unknown email and wrong password |
| POST | `/api/auth/logout` | — | Clears the cookie |
| GET | `/api/auth/me` | — | Current account |
| POST | `/api/auth/password` | `currentPassword`, `newPassword` | |

## Member

Everything below requires a session.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/users/me` | Account with its selected charity |
| PUT | `/api/users/me` | `firstName?`, `lastName?`, `homeClub?`, `handicap?` |
| POST | `/api/users/charity` | `charityId`, `charityPercent` (10–100). No subscription required — this is onboarding |
| GET | `/api/dashboard` | The whole dashboard in one call |
| GET | `/api/subscription` | Current membership, entitlement flag and payment history |
| POST | `/api/subscription/checkout` | `planCode: 'monthly' \| 'yearly'` → `{ checkoutUrl }` |
| POST | `/api/subscription/portal` | → `{ portalUrl }` |
| POST | `/api/subscription/cancel` | Cancels at period end |
| GET | `/api/draws/me` | This member's entries across draws |
| GET | `/api/winners/me` | Wins with their allowed next actions, plus a summary |
| POST | `/api/winners/:id/proof` | `multipart/form-data`, field `proof`. PNG/JPEG/WebP/PDF, ≤5MB |

### Scores — requires an **active** subscription

`authenticate` then `requireSubscription`. A lapsed member gets 403 here while
keeping read access elsewhere.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/scores` | Retained scores, newest first, with retention and summary |
| POST | `/api/scores` | `value` (1–45), `playedOn` (`YYYY-MM-DD`), `courseName?`, `notes?`. Returns `{ score, evicted }` |
| PUT | `/api/scores/:id` | Same rules as creation |
| DELETE | `/api/scores/:id` | 204 |

Posting a sixth score succeeds and returns the evicted row in `evicted`.
Posting a second score for a date already used returns 409.

## Administrator

All of `/api/admin/*` requires `role = admin`, enforced at the router.

### Console and reporting

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/overview` | Headline platform state |
| GET | `/api/admin/reports` | Chart series: growth, contributions, pool history, participation, winner distribution, plan mix, score spread, top charities |
| GET | `/api/admin/audit` | Paginated audit log |

### Users, subscriptions, scores

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/users` | `search`, `role`, `status`, `page`, `pageSize` |
| PATCH | `/api/admin/users/:id/status` | `status: 'active' \| 'suspended'` |
| GET | `/api/admin/subscriptions` | Read-only; provider owns this state |
| GET | `/api/admin/scores` | `search` by member email |
| PUT | `/api/admin/scores/:id` | Correction — audited, same rules as member entry |
| DELETE | `/api/admin/scores/:id` | Audited |

### Draws

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/draws` | All draws |
| POST | `/api/admin/draws` | `strategy?`, `periodMonth?`. Carries forward any unclaimed jackpot |
| GET | `/api/admin/draws/:id` | Detail plus simulation history |
| PATCH | `/api/admin/draws/:id` | `strategy?`, `entriesCloseAt?`, `drawAt?`. Blocked once published |
| POST | `/api/admin/draws/:id/entries` | Rebuilds the field from entitled members |
| POST | `/api/admin/draws/:id/simulate` | `strategy?`, `seed?`. **Writes only to `draw_simulations`** |
| POST | `/api/admin/draws/:id/publish` | `confirm: true` (required), `seed?`, `strategy?`. One transaction, irreversible |

Publishing with the seed from a simulation reproduces that simulation exactly —
the generator is seeded, so the reviewed outcome is the committed outcome.

### Charities

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/charities` | Includes hidden entries |
| POST | `/api/admin/charities` | Full charity record |
| PUT | `/api/admin/charities/:id` | Partial update |
| DELETE | `/api/admin/charities/:id` | Deactivates — never deletes, so contribution history survives |
| POST | `/api/admin/charities/:id/events` | `title`, `startsAt`, `description?`, `venue?` |

### Winners

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/winners` | `state`, `page`, `pageSize`. Each row carries its `actions` |
| GET | `/api/admin/winners/:id/proof` | Returns a signed URL valid for 15 minutes |
| POST | `/api/admin/winners/:id/review` | → `UNDER_REVIEW` |
| POST | `/api/admin/winners/:id/verify` | `notes?` → `APPROVED`, payout queued |
| POST | `/api/admin/winners/:id/reject` | `notes` (5–500 chars, required) → `REJECTED` |
| POST | `/api/admin/winners/:id/payout` | `method?`, `reference?` → `PAID` |

## Webhooks

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/payments/webhook` | Raw body, mounted **before** `express.json`. Signature verified; unsigned requests get 400 |

Every event is recorded in `webhook_events` keyed on `(provider, event_id)`
before processing, so a replay is a no-op. Nothing is marked paid anywhere else
in the system — checkout only creates a session, and the webhook is what makes
a subscription active.

## Example

```bash
# Sign in and keep the session cookie
curl -c jar.txt -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"amara.okafor@example.test","password":"DigitalHeroes2026!"}'

# Log a score
curl -b jar.txt -X POST http://localhost:4000/api/scores \
  -H 'Content-Type: application/json' \
  -d '{"value":38,"playedOn":"2026-09-14","courseName":"Royal Dornoch"}'
```
