'use client'

import { useState, useMemo } from 'react'
import { useTrueMarkets } from '@/lib/useTrueMarkets'
import { deriveSpreadSeries, deriveRollSpread, deriveGKVolatility, deriveCandles } from '@/lib/metrics'

import StatusBar       from './StatusBar'
import OrderBook       from './OrderBook'
import TradeTape       from './TradeTape'
import PriceChart      from './PriceChart'
import SpreadChart     from './SpreadChart'
import RollSpreadChart from './RollSpreadChart'
import VolatilityChart from './VolatilityChart'
import Screener        from './Screener'

// ─── Accent color map ─────────────────────────────────────────────────────────

const ACCENT: Record<string, string> = {
  violet:  'border-t-violet-500/50',
  blue:    'border-t-blue-500/50',
  emerald: 'border-t-emerald-500/50',
  cyan:    'border-t-cyan-500/50',
  amber:   'border-t-amber-500/50',
  zinc:    'border-t-zinc-700/50',
}

function Panel({ label, children, className = '', accent = 'zinc' }: {
  label?: string; children: React.ReactNode; className?: string; accent?: string
}) {
  return (
    <div className={`bg-[#0d0d10] border border-zinc-800/40 border-t-2 ${ACCENT[accent] ?? ACCENT.zinc} rounded-xl flex flex-col overflow-hidden ${className}`}>
      {label && (
        <div className="px-4 pt-3 pb-0 flex-shrink-0">
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">{label}</span>
        </div>
      )}
      <div className="flex-1 min-h-0 p-4 pt-2">{children}</div>
    </div>
  )
}

function NoData({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-1.5 text-zinc-700">
      <div className="w-7 h-7 rounded-full border border-zinc-800 flex items-center justify-center mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" />
      </div>
      <div className="text-xs text-zinc-600">{label}</div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { state, status, messageCount, symbols, assets } = useTrueMarkets()
  const [activeSymbol, setActiveSymbol] = useState<string>('')

  const sym      = (symbols.includes(activeSymbol) ? activeSymbol : symbols[0]) || ''
  const symState = sym ? state[sym] : undefined
  const hasEBBO  = (symState?.ebboHistory.length ?? 0) > 0

  const candles = useMemo(
    () => hasEBBO ? deriveCandles(symState!.ebboHistory) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symState?.ebboHistory.length]
  )

  const spreadData = useMemo(
    () => hasEBBO ? deriveSpreadSeries(symState!.ebboHistory) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symState?.ebboHistory.length]
  )

  const rollData = useMemo(
    () => hasEBBO ? deriveRollSpread(symState!.ebboHistory) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symState?.ebboHistory.length]
  )

  const volData = useMemo(
    () => candles.length >= 20 ? deriveGKVolatility(candles) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candles.length]
  )

  const breadth = useMemo(() => {
    let up = 0, down = 0
    for (const s of symbols) {
      const change = state[s]?.instrument?.change24hPct
      if (change == null) continue
      if (change >= 0) up++; else down++
    }
    return { up, down }
  }, [symbols, state])

  return (
    <div className="h-screen bg-[#08080b] text-zinc-100 flex flex-col overflow-hidden">
      <StatusBar
        status={status}
        messageCount={messageCount}
        symbols={symbols}
        activeSymbol={sym}
        onSymbolChange={setActiveSymbol}
        breadth={breadth}
      />

      <div className="flex-1 min-h-0 p-3 grid gap-2 overflow-hidden"
        style={{
          gridTemplateColumns: '220px 1fr 1fr 1fr',
          gridTemplateRows: '1fr 180px 180px',
        }}>

        <Panel label="Instrument" accent="violet" className="row-span-2">
          {sym ? (
            <OrderBook
              ebbo={symState?.latestEBBO ?? null}
              instrument={symState?.instrument ?? null}
              symbol={sym}
              asset={assets[sym]}
            />
          ) : (
            <NoData label="No instrument" />
          )}
        </Panel>

        <Panel label="Price" accent="blue" className="col-span-3 row-span-1">
          {hasEBBO
            ? <PriceChart ebboHistory={symState!.ebboHistory} />
            : <NoData label="Price chart" />}
        </Panel>

        <Panel label="Bid–Ask Spread" accent="emerald">
          {hasEBBO
            ? <SpreadChart data={spreadData} symbol={sym} />
            : <NoData label="Spread" />}
        </Panel>

        <Panel label="Roll's Implied Spread" accent="cyan">
          {rollData.length
            ? <RollSpreadChart data={rollData} />
            : <NoData label="Roll estimator" />}
        </Panel>

        <Panel label="Garman-Klass Volatility" accent="violet">
          {volData.length
            ? <VolatilityChart data={volData} />
            : <NoData label="Volatility" />}
        </Panel>

        <Panel label="Market" accent="amber">
          <Screener state={state} symbols={symbols} activeSymbol={sym} onSymbolChange={setActiveSymbol} />
        </Panel>

        <Panel label="Candle Feed" accent="zinc" className="col-span-3">
          <TradeTape trades={symState?.tradeHistory ?? []} />
        </Panel>

      </div>
    </div>
  )
}
