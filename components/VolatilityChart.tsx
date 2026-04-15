'use client'

import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { VolatilityPoint } from '@/lib/types'

interface Props { data: VolatilityPoint[] }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-950/95 border border-zinc-700/60 rounded-lg px-3 py-2 text-xs shadow-2xl backdrop-blur">
      <p className="text-zinc-500 mb-1.5 font-mono text-[10px]">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span className="text-zinc-400 text-[10px]">{p.name}</span>
          <span className="font-mono text-[10px]" style={{ color: p.color || p.stroke }}>
            {typeof p.value === 'number' ? p.value.toFixed(p.dataKey === 'rollingVol' ? 1 : 4) : p.value}
            {p.dataKey === 'rollingVol' ? '%' : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function VolatilityChart({ data }: Props) {
  if (!data.length) return null

  const latest = data.at(-1)
  const max = Math.max(...data.map(d => d.rollingVol))
  const volColor = (v: number) => v > 100 ? '#f43f5e' : v > 50 ? '#f59e0b' : '#a78bfa'

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline gap-2 mb-1 flex-shrink-0">
        <span className="text-base font-mono font-bold" style={{ color: volColor(latest?.rollingVol ?? 0) }}>
          {latest?.rollingVol.toFixed(1)}%
        </span>
        <span className="text-[10px] text-zinc-500">GK ann. σ</span>
        <span className="text-[10px] text-zinc-600 font-mono ml-auto">peak {max.toFixed(1)}%</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#3f3f46', fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis yAxisId="vol"   orientation="left"  tick={{ fontSize: 8, fill: '#3f3f46', fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={34} tickFormatter={v => `${v.toFixed(0)}%`} />
            <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 8, fill: '#3f3f46', fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={56} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(2)} />
            <Tooltip content={<CustomTooltip />} />
            <Area  yAxisId="vol"   type="monotone" dataKey="rollingVol" name="GK Vol"
              stroke="#a78bfa" strokeWidth={1.5} fill="url(#volGrad)" dot={false} isAnimationActive={false} />
            <Line  yAxisId="price" type="monotone" dataKey="midPrice"   name="Mid"
              stroke="#3b82f6" strokeWidth={1} dot={false} strokeDasharray="4 2" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
