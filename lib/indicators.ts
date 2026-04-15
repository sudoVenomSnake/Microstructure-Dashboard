/**
 * Pure indicator computations derived exclusively from real WebSocket data.
 * No random seeds, no synthetic fallbacks.
 * If there are insufficient data points the function returns an empty array.
 */

import { EBBOSnapshot, TradeEvent } from './types'

// ─── EMA ─────────────────────────────────────────────────────────────────────
/**
 * Exponential Moving Average
 *
 * k  = 2 / (period + 1)                     (smoothing factor)
 * EMA(0) = price[0]                          (seed = first price)
 * EMA(t) = price[t] × k + EMA(t-1) × (1-k)
 *
 * Requires at least `period` data points; returns NaN-free array padded with
 * null for the warm-up phase so Recharts can gap-render it cleanly.
 */
export function ema(prices: number[], period: number): (number | null)[] {
  if (prices.length < period) return prices.map(() => null)
  const k = 2 / (period + 1)
  const result: (number | null)[] = new Array(prices.length).fill(null)
  // Seed with SMA of first `period` values
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  result[period - 1] = prev
  for (let i = period; i < prices.length; i++) {
    prev = prices[i] * k + prev * (1 - k)
    result[i] = prev
  }
  return result
}

// ─── SMA ─────────────────────────────────────────────────────────────────────
/**
 * Simple Moving Average
 *
 * SMA(t, n) = (1/n) × Σ price[t-n+1 … t]
 */
export function sma(prices: number[], period: number): (number | null)[] {
  if (prices.length < period) return prices.map(() => null)
  const result: (number | null)[] = new Array(prices.length).fill(null)
  let windowSum = prices.slice(0, period).reduce((a, b) => a + b, 0)
  result[period - 1] = windowSum / period
  for (let i = period; i < prices.length; i++) {
    windowSum += prices[i] - prices[i - period]
    result[i] = windowSum / period
  }
  return result
}

// ─── Bollinger Bands ──────────────────────────────────────────────────────────
/**
 * Bollinger Bands (John Bollinger, 1980s)
 *
 * Middle  = SMA(price, period)
 * σ(t, n) = √[ (1/n) × Σ(price[i] - SMA)² ]   (population std dev)
 * Upper   = Middle + mult × σ
 * Lower   = Middle - mult × σ
 *
 * Default: period=20, mult=2.0
 */
export function bollingerBands(
  prices: number[],
  period = 20,
  mult = 2,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const n = prices.length
  const upper: (number | null)[] = new Array(n).fill(null)
  const middle: (number | null)[] = new Array(n).fill(null)
  const lower: (number | null)[] = new Array(n).fill(null)

  if (n < period) return { upper, middle, lower }

  for (let i = period - 1; i < n; i++) {
    const window = prices.slice(i - period + 1, i + 1)
    const avg = window.reduce((a, b) => a + b, 0) / period
    const variance = window.reduce((a, b) => a + (b - avg) ** 2, 0) / period
    const stdDev = Math.sqrt(variance)
    middle[i] = avg
    upper[i] = avg + mult * stdDev
    lower[i] = avg - mult * stdDev
  }
  return { upper, middle, lower }
}

// ─── VWAP ─────────────────────────────────────────────────────────────────────
/**
 * Volume-Weighted Average Price (session-level, reset each day)
 *
 * VWAP(t) = Σ(price[i] × vol[i])  /  Σ(vol[i])   for i = 0…t
 *
 * Computed from the trade tape.  Indexed to the same timestamp array as
 * ebboHistory — each EBBO snapshot gets the VWAP as of that moment.
 * Returns null when no trade has occurred yet.
 */
export function vwapFromTrades(
  ebboHistory: EBBOSnapshot[],
  tradeHistory: TradeEvent[],
): (number | null)[] {
  if (!ebboHistory.length || !tradeHistory.length) return ebboHistory.map(() => null)

  // Build a running VWAP timeline keyed to EBBO snapshot timestamps
  let cumPV = 0
  let cumVol = 0
  let tradeIdx = 0
  const sorted = [...tradeHistory].sort((a, b) => a.ts - b.ts)

  return ebboHistory.map(snap => {
    // Absorb all trades that occurred at or before this EBBO snapshot
    while (tradeIdx < sorted.length && sorted[tradeIdx].ts <= snap.ts) {
      const t = sorted[tradeIdx]
      cumPV += t.price * t.qty
      cumVol += t.qty
      tradeIdx++
    }
    return cumVol > 0 ? cumPV / cumVol : null
  })
}

// ─── RSI ──────────────────────────────────────────────────────────────────────
/**
 * Relative Strength Index (J. Welles Wilder, 1978)
 *
 * Step 1: diffs[i] = price[i] - price[i-1]
 * Step 2: gain[i] = max(diffs[i], 0),  loss[i] = max(-diffs[i], 0)
 * Step 3: Seed:
 *           avgGain = mean(gain[1…period])
 *           avgLoss = mean(loss[1…period])
 * Step 4: Wilder smoothing for i > period:
 *           avgGain = (avgGain × (period-1) + gain[i]) / period
 *           avgLoss = (avgLoss × (period-1) + loss[i]) / period
 * Step 5: RS = avgGain / avgLoss
 *         RSI = 100 - 100 / (1 + RS)
 *
 * Returns values in [0, 100]. Null during warm-up. avgLoss=0 → RSI=100.
 */
export function rsi(prices: number[], period = 14): (number | null)[] {
  const n = prices.length
  if (n < period + 1) return new Array(n).fill(null)

  const result: (number | null)[] = new Array(n).fill(null)
  const diffs = prices.slice(1).map((p, i) => p - prices[i])
  const gains = diffs.map(d => Math.max(d, 0))
  const losses = diffs.map(d => Math.max(-d, 0))

  // Seed averages from first `period` diffs
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

  const calcRSI = (ag: number, al: number) =>
    al === 0 ? 100 : 100 - 100 / (1 + ag / al)

  result[period] = calcRSI(avgGain, avgLoss)  // aligns to prices index period

  for (let i = period; i < diffs.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
    result[i + 1] = calcRSI(avgGain, avgLoss)
  }
  return result
}

// ─── Convenience: build all indicator series from EBBOHistory ─────────────────

export interface IndicatorSeries {
  ema10:   (number | null)[]
  ema20:   (number | null)[]
  ema50:   (number | null)[]
  bbUpper: (number | null)[]
  bbMid:   (number | null)[]
  bbLower: (number | null)[]
  vwap:    (number | null)[]
  rsi14:   (number | null)[]
}

export function computeIndicators(
  ebboHistory: EBBOSnapshot[],
  tradeHistory: TradeEvent[],
): IndicatorSeries {
  const prices = ebboHistory.map(s => s.mid)
  const bb = bollingerBands(prices)
  return {
    ema10:   ema(prices, 10),
    ema20:   ema(prices, 20),
    ema50:   ema(prices, 50),
    bbUpper: bb.upper,
    bbMid:   bb.middle,
    bbLower: bb.lower,
    vwap:    vwapFromTrades(ebboHistory, tradeHistory),
    rsi14:   rsi(prices, 14),
  }
}
