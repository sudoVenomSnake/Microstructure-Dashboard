'use client'

import { useRef, useEffect, useState } from 'react'
import { CandleData } from '@/lib/types'

// ─── Layout constants ─────────────────────────────────────────────────────────

const CANDLE_W = 7   // body px
const GAP      = 4   // gap between candles
const STEP     = CANDLE_W + GAP  // 11px per candle
const Y_W      = 64  // fixed y-axis width
const N_TICKS  = 5

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceLabel(p: number) {
  return p >= 1_000_000 ? `${(p / 1_000_000).toFixed(2)}M`
    : p >= 1_000 ? `${(p / 1_000).toFixed(2)}k`
    : p >= 1    ? p.toFixed(2)
    : p >= 0.01 ? p.toFixed(4)
    : p.toFixed(8)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  candles: CandleData[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CandlestickChart({ candles }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const scrollRef     = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 220 })

  // Measure container width + height
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect
      setDims({ w: width - Y_W, h: Math.max(height, 60) })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Auto-scroll to the right edge, but only when user is already near the right
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearRight = el.scrollWidth - el.scrollLeft - el.clientWidth < 80
    if (nearRight) el.scrollLeft = el.scrollWidth
  }, [candles.length])

  if (!candles.length) return <div ref={containerRef} className="w-full h-full" />

  // Price extent (from all candle highs/lows)
  const allPrices = candles.flatMap(c => [c.high, c.low])
  const rawMin    = Math.min(...allPrices)
  const rawMax    = Math.max(...allPrices)
  const pad       = (rawMax - rawMin) * 0.08 || rawMax * 0.002
  const priceMin  = rawMin - pad
  const priceMax  = rawMax + pad

  const chartH = dims.h
  const chartW = Math.max(dims.w, candles.length * STEP + 24)

  // Price → y coordinate
  const py = (price: number) =>
    chartH - ((price - priceMin) / (priceMax - priceMin)) * chartH

  // Y-axis ticks
  const ticks = Array.from({ length: N_TICKS }, (_, i) => {
    const price = priceMin + (priceMax - priceMin) * (i / (N_TICKS - 1))
    return { price, y: py(price) }
  }).reverse()

  const lastIdx = candles.length - 1

  return (
    <div ref={containerRef} className="flex w-full h-full">

      {/* Fixed Y-axis */}
      <svg width={Y_W} height={chartH} className="flex-shrink-0 overflow-visible">
        {ticks.map(({ price, y }) => (
          <g key={price}>
            <line x1={0} y1={y} x2={Y_W} y2={y} stroke="#18181b" strokeWidth={1} />
            <text
              x={Y_W - 4} y={y}
              textAnchor="end" dominantBaseline="middle"
              style={{ fontSize: 9, fill: '#3f3f46', fontFamily: 'ui-monospace,monospace' }}
            >
              {priceLabel(price)}
            </text>
          </g>
        ))}
      </svg>

      {/* Scrollable candle area */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto scrollbar-none min-w-0">
        <svg width={chartW} height={chartH} style={{ display: 'block' }}>

          {/* Horizontal grid lines */}
          {ticks.map(({ price, y }) => (
            <line key={price} x1={0} y1={y} x2={chartW} y2={y}
              stroke="#18181b" strokeWidth={1} />
          ))}

          {/* ── Candles ───────────────────────────────────────────────── */}

          {candles.map((c, i) => {
            const isLast = i === lastIdx
            const x      = i * STEP
            const cx     = x + CANDLE_W / 2
            const bodyT  = py(Math.max(c.open, c.close))
            const bodyB  = py(Math.min(c.open, c.close))
            const bodyH  = Math.max(bodyB - bodyT, 1)
            const wickT  = py(c.high)
            const wickB  = py(c.low)
            const color  = c.isBull ? '#00d4aa' : '#ff3d6b'

            return (
              <g key={c.ts}>
                {/* Wick */}
                <line
                  x1={cx} y1={wickT} x2={cx} y2={wickB}
                  stroke={color} strokeWidth={1}
                  opacity={isLast ? 0.9 : 0.65}
                />
                {/* Body */}
                <rect
                  x={x} y={bodyT}
                  width={CANDLE_W} height={bodyH}
                  fill={isLast ? color : `${color}cc`}
                  rx={0.5}
                />
                {/* Forming candle: pulsing dot at close */}
                {isLast && (
                  <>
                    {/* Static dot */}
                    <circle cx={cx} cy={py(c.close)} r={2.5} fill={color} />
                    {/* Animated ring */}
                    <circle cx={cx} cy={py(c.close)} r={2.5} fill={color}
                      style={{ animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite', transformOrigin: `${cx}px ${py(c.close)}px` }}
                    />
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Inline keyframes for the ping animation (SVG-safe) */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
