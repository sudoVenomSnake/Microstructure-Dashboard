'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { TradeFreqBucket } from '@/lib/types'

interface Props { data: TradeFreqBucket[] }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const buy = payload[0]?.value || 0
  const sell = payload[1]?.value || 0
  const total = buy + sell
  const pct = total ? Math.round((buy / total) * 100) : 50
  return (
    <div className="bg-zinc-900/95 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="text-zinc-500 mb-1.5 font-mono">{label}</p>
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between gap-4">
          <span className="text-emerald-400">Buy</span>
          <span className="font-mono text-emerald-400">{buy}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-rose-400">Sell</span>
          <span className="font-mono text-rose-400">{sell}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-zinc-800 pt-1 mt-0.5">
          <span className="text-zinc-400">Total</span>
          <span className="font-mono text-zinc-300">{total} ({pct}% buy)</span>
        </div>
      </div>
    </div>
  )
}

export default function TradeFreqChart({ data }: Props) {
  const totalBuy = data.reduce((s, d) => s + d.buyCount, 0)
  const totalSell = data.reduce((s, d) => s + d.sellCount, 0)
  const total = totalBuy + totalSell

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 mb-2 flex-shrink-0">
        <span className="text-base font-mono font-bold text-zinc-200">{total}</span>
        <span className="text-[10px] text-zinc-500">trades · 10s buckets</span>
        <div className="ml-auto flex items-center gap-2 text-[10px] font-mono">
          <span className="text-emerald-400">{totalBuy}B</span>
          <span className="text-zinc-700">/</span>
          <span className="text-rose-400">{totalSell}S</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="25%" margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#3f3f46' }} tickLine={false} axisLine={false} interval={Math.floor(data.length / 5)} />
            <YAxis tick={{ fontSize: 8, fill: '#3f3f46' }} tickLine={false} axisLine={false} width={20} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
            <Bar dataKey="buyCount" name="Buy" stackId="a" fill="#10b981" isAnimationActive={false} />
            <Bar dataKey="sellCount" name="Sell" stackId="a" fill="#f43f5e" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
