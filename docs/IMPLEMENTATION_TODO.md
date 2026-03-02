# Cursor Implementation Task List (Module-split)

## Phase 1
- [ ] Define domain models (Market, Signal, Position, RiskState, OrderIntent)
- [ ] Implement scanner client (REST)
- [ ] Implement deterministic filter rules
- [ ] Implement scoring model (0-5 normalized components)
- [ ] Implement watchlist persistence
- [ ] Implement structured evaluation logs

## Phase 2
- [ ] Build external fetcher interfaces + adapters (count/sports)
- [ ] Implement fetcher heartbeat + stale detector
- [ ] Implement counting fair-prob model
- [ ] Implement signal evaluator (edge/raw_ev/ev_day)
- [ ] Add no-trade gate for unparsable resolution rules

## Phase 3
- [ ] Build execution gateway abstraction
- [ ] Implement maker-first order policy
- [ ] Implement pre-trade risk checks
- [ ] Implement cancel/reprice stale orders
- [ ] Implement MTM drawdown kill-switch

## Phase 4
- [ ] Build sports live-state probability model (simple MVP)
- [ ] Add websocket subscriptions for active markets
- [ ] Event-driven signal refresh
- [ ] Daily summary generator
- [ ] Optional LLM summary hook (offline only)
