import { EBBOSnapshot, TradeEvent, SpreadPoint, TradeFreqBucket, SizeBucket, VolatilityPoint, CandleData, RollSpreadPoint } from './types'

const fmt = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

// ─── Candlestick aggregation (30s buckets from EBBO tick history) ─────────────
// Each EBBO snapshot represents the current state of the forming 30s candle.
// We group ticks by their 30s time bucket and build OHLC candles.

export function deriveCandles(ebboHistory: EBBOSnapshot[], bucketMs = 30_000): CandleData[] {
  if (!ebboHistory.length) return []

  const map = new Map<number, { open: number; high: number; low: number; close: number }>()

  for (const snap of ebboHistory) {
    const key = Math.floor(snap.ts / bucketMs) * bucketMs
    const existing = map.get(key)
    // ask = 30s candle high proxy, bid = low proxy, mid = close
    const high = Math.max(snap.ask, snap.mid)
    const low  = snap.bid > 0 ? Math.min(snap.bid, snap.mid) : snap.mid

    if (!existing) {
      map.set(key, { open: snap.open || snap.mid, high, low, close: snap.mid })
    } else {
      existing.high  = Math.max(existing.high, high)
      existing.low   = Math.min(existing.low, low)
      existing.close = snap.mid
    }
  }

  const entries = Array.from(map.entries()).sort(([a], [b]) => a - b)
  const lastTs  = entries.at(-1)?.[0] ?? 0

  return entries.map(([ts, ohlc]) => ({
    ts,
    time:      fmt(ts),
    open:      ohlc.open,
    high:      ohlc.high,
    low:       ohlc.low,
    close:     ohlc.close,
    isBull:    ohlc.close >= ohlc.open,
    isForming: ts === lastTs,
  }))
}

// ─── Spread over time ─────────────────────────────────────────────────────────

export function deriveSpreadSeries(history: EBBOSnapshot[], maxPoints = 120): SpreadPoint[] {
  const step = Math.max(1, Math.floor(history.length / maxPoints))
  return history
    .filter((_, i) => i % step === 0)
    .map(s => ({
      ts: s.ts,
      time: fmt(s.ts),
      spreadBps: parseFloat(s.spreadBps.toFixed(2)),
      spread: parseFloat(s.spread.toFixed(6)),
    }))
}

// ─── Trade frequency (rolling 10-second buckets) ──────────────────────────────

export function deriveTradeFreq(trades: TradeEvent[], windowMs = 10_000, buckets = 30): TradeFreqBucket[] {
  const now = Date.now()
  const result: TradeFreqBucket[] = []
  for (let i = buckets - 1; i >= 0; i--) {
    const end = now - i * windowMs
    const start = end - windowMs
    const bucket = trades.filter(t => t.ts >= start && t.ts < end)
    result.push({
      time: fmt(start),
      count: bucket.length,
      buyCount: bucket.filter(t => t.side === 'BUY').length,
      sellCount: bucket.filter(t => t.side === 'SELL').length,
    })
  }
  return result
}

// ─── Trade size distribution ──────────────────────────────────────────────────

export function deriveSizeDistribution(trades: TradeEvent[]): SizeBucket[] {
  if (!trades.length) return []
  const qtys = trades.map(t => t.qty)
  const min = Math.min(...qtys)
  const max = Math.max(...qtys)

  if (max === min) {
    return [{ range: `${min.toFixed(4)}`, count: trades.length, pct: 100 }]
  }

  // Use log-scale bins
  const logMin = Math.log10(Math.max(min, 1e-8))
  const logMax = Math.log10(max)
  const NUM_BINS = 8
  const binWidth = (logMax - logMin) / NUM_BINS

  const bins: number[] = new Array(NUM_BINS).fill(0)
  for (const q of qtys) {
    const idx = Math.min(Math.floor((Math.log10(Math.max(q, 1e-8)) - logMin) / binWidth), NUM_BINS - 1)
    bins[idx]++
  }

  return bins.map((count, i) => {
    const lo = Math.pow(10, logMin + i * binWidth)
    const hi = Math.pow(10, logMin + (i + 1) * binWidth)
    return {
      range: lo < 0.01 ? `<0.01` : lo < 1 ? `${lo.toFixed(3)}–${hi.toFixed(3)}` : `${lo.toFixed(2)}–${hi.toFixed(2)}`,
      count,
      pct: parseFloat(((count / trades.length) * 100).toFixed(1)),
    }
  })
}

// ─── Roll's Spread Estimator (Roll 1984) ──────────────────────────────────────
// The serial covariance of successive price changes is negative when bid-ask
// bounce is present. Roll's estimator: spread ≈ 2√(−Cov(Δr_t, Δr_{t−1})).
// Returns 0 when Cov ≥ 0 (no detectable bounce in this window).

export function deriveRollSpread(history: EBBOSnapshot[], windowSize = 30, maxPoints = 120): RollSpreadPoint[] {
  if (history.length < windowSize + 1) return []
  const step = Math.max(1, Math.floor(history.length / maxPoints))
  const result: RollSpreadPoint[] = []

  for (let i = windowSize; i < history.length; i += step) {
    const slice = history.slice(i - windowSize, i + 1)
    const returns: number[] = []
    for (let j = 1; j < slice.length; j++) {
      if (slice[j - 1].mid > 0 && slice[j].mid > 0) {
        returns.push(Math.log(slice[j].mid / slice[j - 1].mid))
      }
    }
    if (returns.length < 3) continue

    // Serial covariance Cov(r_t, r_{t-1})
    let covSum = 0
    for (let j = 1; j < returns.length; j++) {
      covSum += returns[j] * returns[j - 1]
    }
    const cov = covSum / (returns.length - 1)

    // Roll's spread in bps (only defined when Cov < 0)
    const rollBps = cov < 0 ? parseFloat((2 * Math.sqrt(-cov) * 10_000).toFixed(2)) : 0

    result.push({
      ts:       history[i].ts,
      time:     fmt(history[i].ts),
      rollBps,
      midPrice: parseFloat(history[i].mid.toFixed(4)),
    })
  }

  return result
}

// ─── Garman-Klass Volatility (uses full OHLC, 4-8× more efficient) ────────────
// GK(t) = 0.5·(ln H/L)² − (2·ln2−1)·(ln C/O)²
// σ_ann = √[mean(GK) × 2880 × 252] × 100   (2880 = 86400s/30s candles per day)

export function deriveGKVolatility(candles: CandleData[], windowSize = 20, maxPoints = 120): VolatilityPoint[] {
  if (candles.length < windowSize) return []
  const step = Math.max(1, Math.floor(candles.length / maxPoints))
  const LN2 = Math.LN2
  const result: VolatilityPoint[] = []

  for (let i = windowSize - 1; i < candles.length; i += step) {
    const slice = candles.slice(i - windowSize + 1, i + 1)
    let sumGK = 0, valid = 0

    for (const c of slice) {
      if (c.high <= 0 || c.low <= 0 || c.open <= 0 || c.close <= 0) continue
      const lnHL = Math.log(c.high / c.low)
      const lnCO = Math.log(c.close / c.open)
      sumGK += 0.5 * lnHL * lnHL - (2 * LN2 - 1) * lnCO * lnCO
      valid++
    }

    if (!valid) continue
    const gkVar = sumGK / valid
    if (gkVar <= 0) continue

    const annualised = Math.sqrt(gkVar * 2_880 * 252) * 100

    result.push({
      ts:        candles[i].ts,
      time:      candles[i].time,
      rollingVol: parseFloat(annualised.toFixed(2)),
      midPrice:  parseFloat(candles[i].close.toFixed(4)),
    })
  }

  return result
}

// ─── Volatility clustering (rolling 20-sample std-dev of log returns) ─────────

export function deriveVolatility(history: EBBOSnapshot[], windowSize = 20, maxPoints = 120): VolatilityPoint[] {
  if (history.length < windowSize + 1) return []
  const step = Math.max(1, Math.floor(history.length / maxPoints))
  const result: VolatilityPoint[] = []

  for (let i = windowSize; i < history.length; i += step) {
    const window = history.slice(i - windowSize, i)
    const logReturns: number[] = []
    for (let j = 1; j < window.length; j++) {
      if (window[j - 1].mid > 0 && window[j].mid > 0) {
        logReturns.push(Math.log(window[j].mid / window[j - 1].mid))
      }
    }
    if (!logReturns.length) continue
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length
    const variance = logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / logReturns.length
    const stdDev = Math.sqrt(variance)
    // Annualise: assume ~1 tick/2s → 43200 ticks/day → 252 trading days
    const annualised = stdDev * Math.sqrt(43_200 * 252) * 100  // in %

    result.push({
      ts: history[i].ts,
      time: fmt(history[i].ts),
      rollingVol: parseFloat(annualised.toFixed(2)),
      midPrice: parseFloat(history[i].mid.toFixed(2)),
    })
  }

  return result
}
