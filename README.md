# Polymarket Quant MVP

Deterministic-first Polymarket trading system + web app dashboard.

## Modules
- Market Scanner (5m REST scan)
- Data Fetchers (external signals + health heartbeat)
- Signal Evaluator (fair prob / edge / EV/day)
- Execution + Risk Manager (maker-first, kill-switch)

## Principles
- 95%+ runtime non-LLM
- LLM optional and out of live execution path
- Fail-safe default: stale/uncertain => stop trading

## Initial Build Order
1. Scanner + filter + scoring + logs
2. Fetchers + stale detection + counting model
3. Execution + risk controls + MTM kill switch
4. Sports model + websocket + daily analytics
