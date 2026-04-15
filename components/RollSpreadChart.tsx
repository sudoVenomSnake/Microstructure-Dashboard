'use client'

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { RollSpreadPoint } from '@/lib/types'

interface Props { data: RollSpreadPoint[] }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value as number
  return (
    <div className="bg-zinc-950/95 border border-zinc-700/60 rounded-lg px-3 py-2 text-xs shadow-2xl backdrop-blur">
      <p className="text-zinc-500 mb-1 font-mono text-[10px]">{label}</p>
      <p className="font-mono font-semibold text-cyan-400">{v?.toFixed(2)} bps</p>
      <p className="text-zinc-600 text-[9px] mt-1">Roll (1984) implied spread</p>
    </div>
  )
}

export default function RollSpreadChart({ data }: Props) {
  if (!data.length) return null

  const latest = data.at(-1)?.rollBps ?? 0
  const avg    = data.reduce((s, d) => s + d.rollBps, 0) / data.length
  const max    = Math.max(...data.map(d => d.rollBps))
  const nonZero = data.filter(d => d.rollBps > 0).length
  const pctDetected = Math.round((nonZero / data.length) * 100)

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline gap-2 mb-1 flex-shrink-0">
        <span className="text-base font-mono font-bold text-cyan-400">{latest.toFixed(2)}</span>
        <span className="text-[10px] text-zinc-500">bps</span>
        <span className="text-[10px] text-zinc-600 font-mono ml-auto">
          {pctDetected}% bounces · avg {avg.toFixed(1)}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="rollGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#3f3f46', fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 8, fill: '#3f3f46', fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={32} tickFormatter={v => v.toFixed(1)} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={avg} stroke="#164e63" strokeDasharray="4 4" strokeWidth={1} />
            <Area type="monotone" dataKey="rollBps" name="Roll Spread"
              stroke="#06b6d4" strokeWidth={1.5} fill="url(#rollGrad)"
              dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
