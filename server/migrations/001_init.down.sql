DROP TABLE IF EXISTS audit_logs, payouts, winner_proofs, winners, draw_simulations,
  draw_results, draw_entries, prize_tiers, prize_pools, draws, draw_configurations,
  scores, donations, charity_contributions, webhook_events, payments, subscriptions,
  subscription_plans, charity_events, charities, users, roles CASCADE;
DROP FUNCTION IF EXISTS touch_updated_at CASCADE;
