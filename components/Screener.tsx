'use client'

import { useState } from 'react'
import { DashboardState } from '@/lib/types'

interface Props {
  state: DashboardState
  symbols: string[]
  activeSymbol: string
  onSymbolChange: (s: string) => void
}

type SortKey = 'symbol' | 'change' | 'spread'

export default function Screener({ state, symbols, activeSymbol, onSymbolChange }: Props) {
  const [sort, setSort] = useState<SortKey>('change')
  const [desc, setDesc] = useState(true)

  // Build rows from state
  const rows = symbols
    .map(sym => {
      const s = state[sym]
      return {
        sym,
        change:  s?.instrument?.change24hPct ?? 0,
        spread:  s?.latestEBBO?.spreadBps ?? 0,
        hasData: !!s?.latestEBBO,
      }
    })
    .sort((a, b) => {
      if (sort === 'symbol') return desc ? b.sym.localeCompare(a.sym) : a.sym.localeCompare(b.sym)
      return desc ? (b[sort] as number) - (a[sort] as number) : (a[sort] as number) - (b[sort] as number)
    })

  function toggleSort(k: SortKey) {
    if (sort === k) setDesc(p => !p)
    else { setSort(k); setDesc(true) }
  }

  const hdr = (k: SortKey, label: string, align = 'text-left') => (
    <button onClick={() => toggleSort(k)}
      className={`${align} text-[9px] uppercase tracking-wider font-medium transition-colors w-full ${sort === k ? 'text-zinc-400' : 'text-zinc-700 hover:text-zinc-500'}`}>
      {label}{sort === k ? (desc ? ' ↓' : ' ↑') : ''}
    </button>
  )

  if (!rows.length) {
    return <div className="h-full flex items-center justify-center text-zinc-700 text-xs font-mono">Awaiting symbols…</div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-[54px_1fr_46px] gap-x-2 px-1 pb-1.5 border-b border-zinc-800/60 flex-shrink-0">
        {hdr('symbol', 'Sym')}
        {hdr('change', '24h %', 'text-right')}
        {hdr('spread', 'Bps', 'text-right')}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-none">
        {rows.map(r => {
          const isActive = r.sym === activeSymbol
          const isPos = r.change >= 0
          return (
            <button key={r.sym} onClick={() => onSymbolChange(r.sym)}
              className={`w-full grid grid-cols-[54px_1fr_46px] gap-x-2 px-1 py-[3px] text-[10px] font-mono text-left
                border-b border-zinc-900/60 transition-colors
                ${isActive ? 'bg-zinc-800/60' : 'hover:bg-zinc-900/40'}`}>
              <span className={`font-medium truncate ${isActive ? 'text-white' : 'text-zinc-400'}`}>{r.sym}</span>
              <span className={`text-right ${!r.hasData ? 'text-zinc-700' : isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                {r.hasData ? `${isPos ? '+' : ''}${r.change.toFixed(2)}%` : '—'}
              </span>
              <span className={`text-right ${r.spread > 0 ? 'text-zinc-600' : 'text-zinc-700'}`}>
                {r.hasData ? r.spread.toFixed(1) : '—'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
