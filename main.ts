// BTC race bot — trades cbBTC/USDC on 1-minute bars (agent-fun/bars-replay/v1).
//
// Strategy (designed and backtested on the kit's frozen dev window):
//   trend-following, long only. Buy the full cash balance when the fast EMA (12)
//   is above the slow EMA (48), the 24-bar momentum is over 90 bps, and the
//   close is above the 240-bar EMA (regime filter, so it does not buy bounces
//   in a falling market). Sell half at +200 bps from the fill price (take
//   profit), sell the rest when the fast EMA crosses back below the slow EMA
//   or the close falls 150 bps below the highest close since entry (trailing
//   stop). After a full exit, wait 30 bars before re-entering, so it does not
//   churn on noise. Many bars are flat (the pool moves only a few times a
//   minute); the momentum filter keeps it in cash then.
//   Dev window backtest: net PnL about +$15 on $1,000, 5 trades, max
//   drawdown about 1.2%. Reversed (falling) window: about -$9, 2 trades.
//   Deterministic: every decision is a pure function of the closes seen so
//   far. No clock, no network, no files, no randomness.
import { runBars } from "./vendor/makefun-bars.ts";
import type { BarsState, Batch } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";
const FAST_N = 12;
const SLOW_N = 48;
const LONG_N = 240;
const MOM_BARS = 24;
const MOM_BPS = 90;
const STOP_BPS = 150;
const TAKE_PROFIT_BPS = 200;
const COOLDOWN_BARS = 30;
const MAX_SLIPPAGE_BPS = 300;
const MIN_BARS = SLOW_N + MOM_BARS + 1;

// Incremental EMA state, seeded on the first close seen.
let emaFast = 0;
let emaSlow = 0;
let emaLong = 0;
let seeded = false;
const closes: number[] = [];

let entryPrice = 0; // actual fill price of the open position
let peakClose = 0; // highest close since entry
let takeProfitDone = false;
let cooldown = 0;

function emaStep(prev: number, price: number, n: number): number {
  const k = 2 / (n + 1);
  return price * k + prev * (1 - k);
}

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    if (state.warmingUp) return [];
    const bar = state.latest.get(SYMBOL);
    if (bar === undefined) return [];
    // No fresh bar for this minute (CBBTC absent from the batch): never
    // decide on stale data — a missing minute must not trigger a trade.
    if (bar.t !== batch.t) return [];
    const close = Number(bar.c);
    closes.push(close);
    if (!seeded) {
      emaFast = emaSlow = emaLong = close;
      seeded = true;
    } else {
      emaFast = emaStep(emaFast, close, FAST_N);
      emaSlow = emaStep(emaSlow, close, SLOW_N);
      emaLong = emaStep(emaLong, close, LONG_N);
    }

    // Track fills: a buy sets the entry price and peak; a sell may empty us.
    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL || fill.status !== "filled") continue;
      if (fill.side === "buy") {
        entryPrice = Number(fill.price);
        peakClose = close;
        takeProfitDone = false;
      }
    }
    const pos = state.positions.get(SYMBOL);
    const qty = pos?.qty ?? 0n;
    if (qty > 0n && close > peakClose) peakClose = close;
    if (closes.length < MIN_BARS) return [];

    const momBps = (close / closes[closes.length - 1 - MOM_BARS] - 1) * 10000;
    const inUptrend = emaFast > emaSlow && momBps > MOM_BPS && close > emaLong;
    if (cooldown > 0) cooldown -= 1;

    if (qty === 0n) {
      if (inUptrend && cooldown === 0 && state.cash >= 1_000_000n) {
        return [
          {
            side: "buy",
            symbol: SYMBOL,
            notional_quote_units: state.cash,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          },
        ];
      }
      return [];
    }

    // Holding: take half the profit first, then exit on reversal or stop.
    if (!takeProfitDone && entryPrice > 0 && (close / entryPrice - 1) * 10000 > TAKE_PROFIT_BPS) {
      takeProfitDone = true;
      return [
        {
          side: "sell",
          symbol: SYMBOL,
          qty: qty / 2n,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        },
      ];
    }
    const stopHit = peakClose > 0 && ((peakClose - close) / peakClose) * 10000 > STOP_BPS;
    if (emaFast < emaSlow || stopHit) {
      cooldown = COOLDOWN_BARS;
      return [
        {
          side: "sell",
          symbol: SYMBOL,
          qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        },
      ];
    }
    return [];
  },
});
