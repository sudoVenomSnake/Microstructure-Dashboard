'use client'

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { SpreadPoint } from '@/lib/types'

interface Props { data: SpreadPoint[]; symbol: string }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900/95 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="text-zinc-500 mb-1 font-mono">{label}</p>
      <p className="text-emerald-400 font-mono font-semibold">{payload[0]?.value?.toFixed(2)} bps</p>
    </div>
  )
}

export default function SpreadChart({ data }: Props) {
  if (!data.length) return null

  const avg = data.reduce((s, d) => s + d.spreadBps, 0) / data.length
  const latest = data.at(-1)?.spreadBps ?? 0
  const delta = latest - avg

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline gap-2 mb-2 flex-shrink-0">
        <span className="text-base font-mono font-bold text-emerald-400">{latest.toFixed(2)}</span>
        <span className="text-[10px] text-zinc-500">bps</span>
        <span className={`text-[10px] font-mono ml-auto ${delta > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
          {delta > 0 ? '+' : ''}{delta.toFixed(2)} vs avg
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="spreadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#3f3f46' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 8, fill: '#3f3f46' }} tickLine={false} axisLine={false} width={32} tickFormatter={v => v.toFixed(1)} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={avg} stroke="#3f3f46" strokeDasharray="4 4" strokeWidth={1} />
            <Area type="monotone" dataKey="spreadBps" stroke="#10b981" strokeWidth={1.5}
              fill="url(#spreadGrad)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
