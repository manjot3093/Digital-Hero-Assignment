-- Digital Heroes — initial schema
-- PostgreSQL 14+. All money is stored in integer minor units (pence/cents).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";        -- case-insensitive email

-- ---------------------------------------------------------------- identity --

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE CHECK (key IN ('subscriber', 'admin')),
  label       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              CITEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  first_name         TEXT NOT NULL CHECK (length(btrim(first_name)) > 0),
  last_name          TEXT NOT NULL CHECK (length(btrim(last_name)) > 0),
  role_id            UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  home_club          TEXT,
  handicap           NUMERIC(4,1) CHECK (handicap IS NULL OR (handicap >= -10 AND handicap <= 54)),
  charity_id         UUID,                       -- FK added after charities
  charity_percent    SMALLINT NOT NULL DEFAULT 10
                     CHECK (charity_percent >= 10 AND charity_percent <= 100),
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'suspended', 'deleted')),
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role      ON users(role_id);
CREATE INDEX idx_users_charity   ON users(charity_id);
CREATE INDEX idx_users_created   ON users(created_at DESC);

-- ---------------------------------------------------------------- charities --

CREATE TABLE charities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  tagline         TEXT,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL,
  region          TEXT NOT NULL DEFAULT 'National',
  hero_image_url  TEXT,
  logo_url        TEXT,
  website_url     TEXT,
  impact_headline TEXT,
  impact_metrics  JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_charities_active   ON charities(is_active) WHERE is_active;
CREATE INDEX idx_charities_featured ON charities(is_featured) WHERE is_featured;
CREATE INDEX idx_charities_category ON charities(category);

ALTER TABLE users
  ADD CONSTRAINT fk_users_charity
  FOREIGN KEY (charity_id) REFERENCES charities(id) ON DELETE SET NULL;

CREATE TABLE charity_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charity_id  UUID NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  venue       TEXT,
  starts_at   TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_charity_events_charity ON charity_events(charity_id, starts_at);

-- ------------------------------------------------------------ subscriptions --

CREATE TABLE subscription_plans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL UNIQUE CHECK (code IN ('monthly', 'yearly')),
  name               TEXT NOT NULL,
  interval           TEXT NOT NULL CHECK (interval IN ('monthly', 'yearly')),
  amount_minor       INTEGER NOT NULL CHECK (amount_minor > 0),
  currency           CHAR(3) NOT NULL DEFAULT 'GBP',
  provider_price_id  TEXT,
  prize_share        NUMERIC(4,3) NOT NULL DEFAULT 0.500
                     CHECK (prize_share >= 0 AND prize_share <= 1),
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id               UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status                TEXT NOT NULL DEFAULT 'incomplete'
                        CHECK (status IN ('incomplete','active','past_due','cancelled','expired')),
  provider              TEXT NOT NULL DEFAULT 'stripe',
  provider_customer_id  TEXT,
  provider_subscription_id TEXT UNIQUE,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_period CHECK (current_period_end IS NULL OR current_period_start IS NULL
                               OR current_period_end > current_period_start)
);

-- A user may only hold one live subscription at a time.
CREATE UNIQUE INDEX uq_subscription_live
  ON subscriptions(user_id)
  WHERE status IN ('incomplete', 'active', 'past_due');

CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period ON subscriptions(current_period_end);

CREATE TABLE payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id    UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  provider           TEXT NOT NULL DEFAULT 'stripe',
  provider_payment_id TEXT UNIQUE,
  amount_minor       INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency           CHAR(3) NOT NULL DEFAULT 'GBP',
  status             TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
  charity_minor      INTEGER NOT NULL DEFAULT 0 CHECK (charity_minor >= 0),
  prize_minor        INTEGER NOT NULL DEFAULT 0 CHECK (prize_minor >= 0),
  platform_minor     INTEGER NOT NULL DEFAULT 0 CHECK (platform_minor >= 0),
  failure_reason     TEXT,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user    ON payments(user_id, created_at DESC);
CREATE INDEX idx_payments_status  ON payments(status);

-- Idempotency guard for webhook replays.
CREATE TABLE webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL DEFAULT 'stripe',
  event_id      TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  payload       JSONB,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

-- ------------------------------------------------------ charity & donations --

CREATE TABLE charity_contributions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charity_id   UUID NOT NULL REFERENCES charities(id) ON DELETE RESTRICT,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id   UUID REFERENCES payments(id) ON DELETE SET NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  percent      SMALLINT NOT NULL CHECK (percent >= 10 AND percent <= 100),
  source       TEXT NOT NULL DEFAULT 'subscription'
               CHECK (source IN ('subscription', 'donation')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contrib_charity ON charity_contributions(charity_id, created_at DESC);
CREATE INDEX idx_contrib_user    ON charity_contributions(user_id, created_at DESC);

-- Independent one-off donations, not tied to gameplay (PRD §08.1).
CREATE TABLE donations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  charity_id          UUID NOT NULL REFERENCES charities(id) ON DELETE RESTRICT,
  donor_name          TEXT,
  donor_email         CITEXT,
  amount_minor        INTEGER NOT NULL CHECK (amount_minor >= 100),
  currency            CHAR(3) NOT NULL DEFAULT 'GBP',
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','succeeded','failed')),
  provider_payment_id TEXT UNIQUE,
  message             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_donations_charity ON donations(charity_id, created_at DESC);

-- ------------------------------------------------------------------ scores --

CREATE TABLE scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value       SMALLINT NOT NULL CHECK (value >= 1 AND value <= 45),
  played_on   DATE NOT NULL,
  course_name TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_score_per_user_per_day UNIQUE (user_id, played_on),
  CONSTRAINT chk_not_future CHECK (played_on <= CURRENT_DATE + 1)
);

CREATE INDEX idx_scores_user_recent ON scores(user_id, played_on DESC);

-- ------------------------------------------------------------------- draws --

CREATE TABLE draw_configurations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  strategy          TEXT NOT NULL DEFAULT 'random' CHECK (strategy IN ('random','weighted')),
  ball_pool_size    SMALLINT NOT NULL DEFAULT 40 CHECK (ball_pool_size BETWEEN 10 AND 99),
  numbers_per_ticket SMALLINT NOT NULL DEFAULT 5 CHECK (numbers_per_ticket BETWEEN 3 AND 10),
  tier_allocation   JSONB NOT NULL DEFAULT '{"5":0.40,"4":0.35,"3":0.25}'::jsonb,
  score_influence   NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  is_default        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_draw_config_default ON draw_configurations(is_default) WHERE is_default;

CREATE TABLE draws (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        TEXT NOT NULL UNIQUE,          -- e.g. DH-2026-05
  period_month     DATE NOT NULL UNIQUE,          -- first day of the draw month
  configuration_id UUID REFERENCES draw_configurations(id) ON DELETE SET NULL,
  strategy         TEXT NOT NULL DEFAULT 'random' CHECK (strategy IN ('random','weighted')),
  status           TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','open','locked','simulated','published','cancelled')),
  entries_close_at TIMESTAMPTZ NOT NULL,
  draw_at          TIMESTAMPTZ NOT NULL,
  published_at     TIMESTAMPTZ,
  published_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  seed             TEXT,
  winning_numbers  SMALLINT[],
  carried_in_minor INTEGER NOT NULL DEFAULT 0 CHECK (carried_in_minor >= 0),
  rollover_minor   INTEGER NOT NULL DEFAULT 0 CHECK (rollover_minor >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_published_has_numbers
    CHECK (status <> 'published' OR (winning_numbers IS NOT NULL AND published_at IS NOT NULL))
);

CREATE INDEX idx_draws_status ON draws(status);
CREATE INDEX idx_draws_month  ON draws(period_month DESC);

CREATE TABLE prize_pools (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id             UUID NOT NULL UNIQUE REFERENCES draws(id) ON DELETE CASCADE,
  subscriber_count    INTEGER NOT NULL DEFAULT 0 CHECK (subscriber_count >= 0),
  contribution_minor  INTEGER NOT NULL DEFAULT 0 CHECK (contribution_minor >= 0),
  carry_over_minor    INTEGER NOT NULL DEFAULT 0 CHECK (carry_over_minor >= 0),
  total_minor         INTEGER NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prize_tiers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id       UUID NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  match_count   SMALLINT NOT NULL CHECK (match_count BETWEEN 3 AND 5),
  share         NUMERIC(4,3) NOT NULL CHECK (share > 0 AND share <= 1),
  amount_minor  INTEGER NOT NULL CHECK (amount_minor >= 0),
  winner_count  INTEGER NOT NULL DEFAULT 0 CHECK (winner_count >= 0),
  per_winner_minor INTEGER NOT NULL DEFAULT 0 CHECK (per_winner_minor >= 0),
  rolled_over   BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT uq_tier_per_draw UNIQUE (draw_id, match_count)
);

CREATE TABLE draw_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id    UUID NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  numbers    SMALLINT[] NOT NULL,
  score_count SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_entry_per_user_per_draw UNIQUE (draw_id, user_id),
  CONSTRAINT chk_entry_numbers CHECK (array_length(numbers, 1) BETWEEN 3 AND 10)
);

CREATE INDEX idx_entries_user ON draw_entries(user_id, created_at DESC);

CREATE TABLE draw_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id         UUID NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  entry_id        UUID NOT NULL REFERENCES draw_entries(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_count     SMALLINT NOT NULL CHECK (match_count BETWEEN 0 AND 10),
  amount_minor    INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_result_per_entry UNIQUE (draw_id, entry_id)
);

CREATE INDEX idx_results_draw ON draw_results(draw_id, match_count DESC);

-- Simulations are stored separately: they never touch prize_tiers or winners.
CREATE TABLE draw_simulations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id      UUID NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  strategy     TEXT NOT NULL,
  seed         TEXT NOT NULL,
  result       JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_simulations_draw ON draw_simulations(draw_id, created_at DESC);

-- ----------------------------------------------------------------- winners --

CREATE TABLE winners (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id        UUID NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result_id      UUID REFERENCES draw_results(id) ON DELETE SET NULL,
  match_count    SMALLINT NOT NULL CHECK (match_count BETWEEN 3 AND 5),
  amount_minor   INTEGER NOT NULL CHECK (amount_minor >= 0),
  state          TEXT NOT NULL DEFAULT 'PENDING_PROOF'
                 CHECK (state IN ('PENDING_PROOF','PROOF_SUBMITTED','UNDER_REVIEW',
                                  'APPROVED','REJECTED','PAYOUT_PENDING','PAID')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid')),
  reviewed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  review_notes   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_winner_per_draw_user UNIQUE (draw_id, user_id, match_count)
);

CREATE INDEX idx_winners_state ON winners(state);
CREATE INDEX idx_winners_user  ON winners(user_id, created_at DESC);

CREATE TABLE winner_proofs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id     UUID NOT NULL REFERENCES winners(id) ON DELETE CASCADE,
  storage_key   TEXT NOT NULL,          -- object storage key, never the bytes
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp','application/pdf')),
  size_bytes    INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  checksum      TEXT,
  is_current    BOOLEAN NOT NULL DEFAULT true,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_current_proof ON winner_proofs(winner_id) WHERE is_current;
CREATE INDEX idx_proofs_winner ON winner_proofs(winner_id, uploaded_at DESC);

CREATE TABLE payouts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id      UUID NOT NULL UNIQUE REFERENCES winners(id) ON DELETE CASCADE,
  amount_minor   INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency       CHAR(3) NOT NULL DEFAULT 'GBP',
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  method         TEXT NOT NULL DEFAULT 'bank_transfer',
  reference      TEXT,
  processed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  processed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payouts_status ON payouts(status);

-- -------------------------------------------------------------- audit logs --

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email   TEXT,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_actor  ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_time   ON audit_logs(created_at DESC);

-- --------------------------------------------------------------- utilities --

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_touch         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_scores_touch        BEFORE UPDATE ON scores        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_subscriptions_touch BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_draws_touch         BEFORE UPDATE ON draws         FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_winners_touch       BEFORE UPDATE ON winners       FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_charities_touch     BEFORE UPDATE ON charities     FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

INSERT INTO roles (key, label) VALUES ('subscriber', 'Subscriber'), ('admin', 'Administrator');
