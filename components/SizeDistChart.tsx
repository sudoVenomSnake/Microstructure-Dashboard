'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { SizeBucket } from '@/lib/types'

interface Props { data: SizeBucket[]; trades: number }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900/95 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="text-zinc-500 mb-1 font-mono">{label}</p>
      <p className="text-amber-400 font-mono font-semibold">{payload[0]?.value} trades</p>
      <p className="text-zinc-500 font-mono">{payload[0]?.payload?.pct}% of sample</p>
    </div>
  )
}

function heatColor(count: number, max: number): string {
  const t = max > 0 ? count / max : 0
  const r = Math.round(245 * t + 39 * (1 - t))
  const g = Math.round(158 * t + 39 * (1 - t))
  const b = Math.round(11 * t + 42 * (1 - t))
  return `rgb(${r},${g},${b})`
}

export default function SizeDistChart({ data, trades }: Props) {
  if (!data.length) return null

  const maxCount = Math.max(...data.map(d => d.count))

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline gap-2 mb-2 flex-shrink-0">
        <span className="text-base font-mono font-bold text-amber-400">{trades}</span>
        <span className="text-[10px] text-zinc-500">trades sampled</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
            <XAxis dataKey="range" tick={{ fontSize: 7, fill: '#3f3f46' }} tickLine={false} axisLine={false} interval={0} angle={-15} dy={4} />
            <YAxis tick={{ fontSize: 8, fill: '#3f3f46' }} tickLine={false} axisLine={false} width={22} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.map((e, i) => <Cell key={i} fill={heatColor(e.count, maxCount)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
