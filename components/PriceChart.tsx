'use client'

import { useState } from 'react'
import { CandleData, EBBOSnapshot } from '@/lib/types'
import CandlestickChart from './CandlestickChart'

// ─── Types ────────────────────────────────────────────────────────────────────

type Timeframe = '30s' | '1m' | '5m'

interface Props {
  candles30s:  CandleData[]
  candles1m:   CandleData[]
  candles5m:   CandleData[]
  latestEBBO:  EBBOSnapshot | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtPrice = (n: number) =>
  n >= 1_000
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toFixed(4)

// ─── Component ────────────────────────────────────────────────────────────────

export default function PriceChart({ candles30s, candles1m, candles5m, latestEBBO }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>('30s')

  const candles = timeframe === '30s' ? candles30s : timeframe === '1m' ? candles1m : candles5m

  const hasData = candles.length > 0
  const latest  = latestEBBO

  if (!hasData) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-700">
        <div className="text-sm">Price chart</div>
        <div className="text-xs">Waiting for feed…</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-2">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">Price</span>
          {latest && (
            <span className="text-sm font-mono font-bold text-white">
              {fmtPrice(latest.mid)}
            </span>
          )}
          <span className="text-[9px] font-mono text-zinc-700">
            {candles.length} candles
          </span>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-1">
          {(['30s', '1m', '5m'] as Timeframe[]).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                timeframe === tf
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* ── Candlestick chart ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        <CandlestickChart candles={candles} />
      </div>
    </div>
  )
}
