'use client'

import { EBBOSnapshot, InstrumentState, Asset } from '@/lib/types'

interface Props {
  ebbo: EBBOSnapshot | null
  instrument: InstrumentState | null
  symbol: string
  asset?: Asset
}

const fmtPrice = (n: number) =>
  n >= 1_000
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n >= 0.01 ? n.toFixed(4) : n.toFixed(8)

const fmtPct = (n: number) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const fmtSupply = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}B`
  : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K`
  : n.toFixed(0)

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    HALTED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    PAUSED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    CLOSED: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  }
  return (
    <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded border tracking-wider ${map[status] ?? map.CLOSED}`}>
      {status}
    </span>
  )
}

function DepthRow({ price, side, maxQty, qty }: {
  price: number; side: 'bid' | 'ask'; maxQty: number; qty: number
}) {
  const pct = Math.min(100, maxQty > 0 ? (qty / maxQty) * 80 + 20 : 20)
  const isAsk = side === 'ask'
  return (
    <div className="relative rounded overflow-hidden">
      <div
        className={`absolute inset-0 ${isAsk ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`}
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex items-center justify-between px-2.5 py-2">
        <span className={`text-sm font-mono font-bold ${isAsk ? 'text-rose-400' : 'text-emerald-300'}`}>
          {fmtPrice(price)}
        </span>
        <span className={`text-[9px] uppercase text-zinc-600 font-mono`}>{side}</span>
      </div>
    </div>
  )
}

export default function OrderBook({ ebbo, instrument, symbol, asset }: Props) {
  const maxQty = 1   // qty not available from DeFi price feed; depth bar uses fixed width
  const bidQty = maxQty
  const askQty = maxQty

  return (
    <div className="h-full flex flex-col gap-3">

      {/* Symbol + chain + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {asset?.icon && (
              <img src={asset.icon} alt={symbol} width={16} height={16} className="rounded-full flex-shrink-0" />
            )}
            <div className="text-base font-bold text-white tracking-tight truncate">{symbol}</div>
          </div>
          {instrument?.chain && (
            <div className="text-[9px] text-zinc-600 font-mono uppercase tracking-wider mt-0.5">
              {instrument.chain}
            </div>
          )}
        </div>
        <StatusPill status={instrument?.status ?? 'ACTIVE'} />
      </div>

      {/* Asset info section */}
      {asset && (
        <div className="flex flex-col gap-1">
          {asset.description && (
            <p className="text-[10px] text-zinc-600 mt-1 line-clamp-2">{asset.description}</p>
          )}
          {(asset.website || asset.twitterUrl || asset.redditUrl) && (
            <div className="flex items-center gap-2 mt-0.5">
              {asset.website && (
                <a href={asset.website} target="_blank" rel="noopener noreferrer"
                  className="text-[9px] text-zinc-700 hover:text-zinc-400 transition-colors">web</a>
              )}
              {asset.twitterUrl && (
                <a href={asset.twitterUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[9px] text-zinc-700 hover:text-zinc-400 transition-colors">𝕏</a>
              )}
              {asset.redditUrl && (
                <a href={asset.redditUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[9px] text-zinc-700 hover:text-zinc-400 transition-colors">reddit</a>
              )}
            </div>
          )}
          {asset.circulatingSupply > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[9px] text-zinc-700 uppercase tracking-wider">Circ</span>
              <span className="text-[9px] font-mono text-zinc-600">{fmtSupply(asset.circulatingSupply)}</span>
              {asset.totalSupply > 0 && (
                <>
                  <span className="text-[9px] text-zinc-800">/</span>
                  <span className="text-[9px] font-mono text-zinc-700">{fmtSupply(asset.totalSupply)}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mid / close price */}
      {ebbo ? (
        <div className="text-center py-2">
          <div className="text-2xl font-bold font-mono tracking-tight" style={{ color: '#e2e8ff' }}>{fmtPrice(ebbo.mid)}</div>
          {instrument && (
            <div className={`text-xs font-semibold font-mono mt-0.5 ${
              instrument.change24hPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {fmtPct(instrument.change24hPct)} 24h
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-zinc-700 text-xs">Awaiting feed…</div>
      )}

      {/* Best bid / ask from 30s candle high/low — always show when ebbo exists */}
      {ebbo && (
        <div className="flex flex-col gap-1 flex-1">
          <DepthRow price={ebbo.ask} side="ask" maxQty={maxQty} qty={askQty} />
          <div className="flex items-center gap-2 py-0.5">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-[9px] text-zinc-600 font-mono whitespace-nowrap">
              {ebbo.spreadBps.toFixed(2)} bps
            </span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
          <DepthRow price={ebbo.bid} side="bid" maxQty={maxQty} qty={bidQty} />
        </div>
      )}

      {/* 24h OHLC from 24h candle */}
      {instrument && instrument.open24h > 0 && (
        <div className="border-t border-zinc-800/60 pt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {[
            { label: '24h Open',  val: instrument.open24h },
            { label: '24h High',  val: instrument.high24h },
            { label: '24h Low',   val: instrument.low24h },
            { label: '24h Close', val: instrument.close24h },
          ].map(({ label, val }) => (
            <div key={label}>
              <div className="text-[9px] text-zinc-700 uppercase tracking-wider">{label}</div>
              <div className="text-[11px] font-mono text-zinc-300 mt-0.5">{fmtPrice(val)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
