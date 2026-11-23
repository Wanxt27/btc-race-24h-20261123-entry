# BTC Race Bot — btc-race-24h-20261123-0511

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/Wanxt27/btc-race-24h-20261123-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/Wanxt27/btc-race-24h-20261123-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

Referral: `qzc860x6` — https://make.fun/r/qzc860x6

A trend-following bot that trades Coinbase Wrapped BTC (cbBTC) against USDC on
1-minute bars, in the make.fun `agent-fun/bars-replay/v1` replay. Long only,
$1,000 paper money, no leverage.

## Strategy

Buy the full cash balance when the fast EMA (12 bars) is above the slow EMA
(48 bars), the 24-bar momentum is over 90 bps, and the close is above the
240-bar EMA (regime filter — it does not buy bounces in a falling market).
Sell half at +200 bps from the fill price, sell the rest when the fast EMA
crosses back below the slow EMA or the close falls 150 bps below the highest
close since entry (trailing stop). After a full exit, wait 30 bars before
re-entering, so it does not churn on noise.

Backtested on the kit's frozen 24-hour dev window: net PnL about +$15 on
$1,000, 5 trades, max drawdown about 1.2%.

## Files

- `main.ts` — the bot (Node 22, erasable TypeScript, standard library only)
- `vendor/makefun-bars.ts` — the kit's protocol shim, copied unchanged
