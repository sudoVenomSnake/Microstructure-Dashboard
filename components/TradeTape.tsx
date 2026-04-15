'use client'

import { TradeEvent } from '@/lib/types'

interface Props { trades: TradeEvent[] }

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

const fmtPrice = (n: number) =>
  n >= 1_000
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n >= 0.01 ? n.toFixed(4) : n.toFixed(8)

const fmtDelta = (delta: number) => {
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta >= 1 ? delta.toFixed(2) : delta.toFixed(4)}`
}

export default function TradeTape({ trades }: Props) {
  const recent = [...trades].reverse().slice(0, 80)

  if (!recent.length) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-700 text-xs font-mono">
        Awaiting candle feed…
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Headers */}
      <div className="grid grid-cols-[80px_1fr_80px_24px] gap-x-3 px-1 pb-1.5 border-b border-zinc-800/60 flex-shrink-0">
        {['Time', 'Close', 'Δ', 'Dir'].map(h => (
          <span key={h} className="text-[9px] uppercase tracking-wider text-zinc-700">{h}</span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-none">
        {recent.map((t, i) => {
          const isBuy  = t.side === 'BUY'
          // Price delta vs previous trade (recent[0] is latest, so previous = recent[i+1])
          const prev   = recent[i + 1]
          const delta  = prev ? t.price - prev.price : null

          return (
            <div
              key={`${t.ts}-${i}`}
              className={`grid grid-cols-[80px_1fr_80px_24px] gap-x-3 px-1 py-[3px] text-[10px] font-mono
                border-b border-zinc-900/80
                ${i === 0 ? 'bg-zinc-900/40' : 'hover:bg-zinc-900/20'}`}
            >
              <span className="text-zinc-600">{fmtTime(t.ts)}</span>
              <span className={isBuy ? 'text-emerald-400' : 'text-rose-400'}>
                {fmtPrice(t.price)}
              </span>
              <span className={
                delta == null ? 'text-zinc-700' :
                delta > 0 ? 'text-emerald-500/80' :
                delta < 0 ? 'text-rose-500/80' :
                'text-zinc-600'
              }>
                {delta == null ? '—' : fmtDelta(delta)}
              </span>
              <span className={isBuy ? 'text-emerald-500' : 'text-rose-500'}>
                {isBuy ? '▲' : '▼'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
