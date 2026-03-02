# Strategy Spec (Boss Draft Synced)

This file captures the provided MVP strategy requirements for implementation.

## Allowed
- Counting markets
- Sports late-stage markets (NBA/NHL/esports)

## Disallowed auto-trade
- Geopolitics, ambiguous resolution, rumor-driven, subjective markets

## Key Runtime Rules
- Scanner: every 5 min, deterministic, no LLM
- Watchlist eval: every 1 min
- Strong candidates: every 10-30 sec (or WS event-driven)
- No LLM in execution path
- Data stale => stop entries + cancel stale orders + alert

## Entry Gating
All required:
- edge >= min_edge_entry
- raw_ev >= min_raw_ev
- ev_per_day >= min_ev_per_day
- spread within limits
- fetchers healthy
- resolution risk acceptable
- allowed market type
- risk budget available

## Risk Controls
- small fixed trade size (MVP: $2)
- max exposure caps (market / strategy / total)
- max daily loss (MVP: $5)
- MTM post-entry adverse move kill switch

## Logging Required
market_id, title, type, ts, market_prob, fair_prob, edge,
raw_ev, ev_per_day, spread, maker/taker, size,
fetch_health, resolution_rule_version, entry_reason, exit_reason, settlement_result
