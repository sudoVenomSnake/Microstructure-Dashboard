'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ConnectionStatus } from '@/lib/types'

interface Props {
  status: ConnectionStatus
  messageCount: number
  symbols: string[]
  activeSymbol: string
  onSymbolChange: (s: string) => void
  breadth?: { up: number; down: number }
}

const STATUS: Record<ConnectionStatus, { dot: string; label: string; textCls: string }> = {
  connected:    { dot: 'bg-emerald-400',             label: 'LIVE',       textCls: 'text-emerald-400' },
  connecting:   { dot: 'bg-amber-400 animate-pulse', label: 'CONNECTING', textCls: 'text-amber-400' },
  disconnected: { dot: 'bg-zinc-600',                label: 'OFFLINE',    textCls: 'text-zinc-500' },
  error:        { dot: 'bg-rose-500',                label: 'ERROR',      textCls: 'text-rose-400' },
}

export default function StatusBar({ status, messageCount, symbols, activeSymbol, onSymbolChange, breadth }: Props) {
  const s = STATUS[status]
  const [query, setQuery]       = useState('')
  const [open, setOpen]         = useState(false)
  const searchRef               = useRef<HTMLDivElement>(null)
  const tabsRef                 = useRef<HTMLDivElement>(null)
  const activeTabRef            = useRef<HTMLButtonElement>(null)

  // Filter symbols by search query
  const filtered = useMemo(
    () => symbols.filter(sym => sym.toLowerCase().includes(query.toLowerCase())),
    [symbols, query]
  )

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Scroll active tab into view when it changes
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [activeSymbol])

  function pick(sym: string) {
    onSymbolChange(sym)
    setQuery('')
    setOpen(false)
  }

  return (
    <header className="flex-shrink-0 flex items-center h-10 border-b border-zinc-800/40 bg-[#09090c]">

      {/* Brand */}
      <div className="flex items-center gap-2 px-4 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_6px_2px_rgba(167,139,250,0.4)]" />
        <span className="text-[11px] font-semibold tracking-[0.08em] text-zinc-200">TrueMarkets</span>
        <span className="text-[10px] text-zinc-700 tracking-widest uppercase hidden sm:block">Monitor</span>
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/10 text-violet-300 tracking-wider hidden sm:block">DeFi</span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-zinc-800 flex-shrink-0" />

      {/* Search / dropdown */}
      <div ref={searchRef} className="relative flex-shrink-0 px-2">
        <div className={`flex items-center gap-1.5 h-6 px-2 rounded border text-[10px] font-mono transition-colors ${
          open ? 'border-zinc-600 bg-zinc-900' : 'border-zinc-800 bg-transparent hover:border-zinc-700'
        }`}>
          <svg className="w-2.5 h-2.5 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
            <circle cx="6.5" cy="6.5" r="4.5" /><path d="m10.5 10.5 3 3" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Search…"
            className="w-20 bg-transparent outline-none text-zinc-300 placeholder-zinc-700 text-[10px] font-mono"
          />
          {query && (
            <button onClick={() => { setQuery(''); setOpen(false) }} className="text-zinc-600 hover:text-zinc-400 flex-shrink-0">
              ×
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && filtered.length > 0 && (
          <div className="absolute top-full left-2 mt-1 w-44 max-h-64 overflow-y-auto scrollbar-thin bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl z-50">
            {filtered.map(sym => (
              <button
                key={sym}
                onClick={() => pick(sym)}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-zinc-800 transition-colors ${
                  sym === activeSymbol ? 'text-white bg-zinc-800/60' : 'text-zinc-400'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable tab strip */}
      <div
        ref={tabsRef}
        className="flex-1 flex items-center gap-0.5 overflow-x-auto scrollbar-none px-1 min-w-0"
      >
        {symbols.length === 0 ? (
          <span className="text-[10px] text-zinc-700 font-mono px-2">Fetching assets…</span>
        ) : (
          symbols.map(sym => (
            <button
              key={sym}
              ref={sym === activeSymbol ? activeTabRef : undefined}
              onClick={() => pick(sym)}
              className={`flex-shrink-0 px-2.5 h-6 rounded text-[10px] font-mono font-medium transition-all whitespace-nowrap ${
                sym === activeSymbol
                  ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
              }`}
            >
              {sym}
            </button>
          ))
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0">
        {breadth && (breadth.up + breadth.down) > 0 && (
          <div className="items-center gap-1 text-[10px] font-mono hidden md:flex">
            <span className="text-emerald-400 font-semibold">↑{breadth.up}</span>
            <span className="text-zinc-700">/</span>
            <span className="text-rose-400 font-semibold">↓{breadth.down}</span>
          </div>
        )}
        {messageCount > 0 && (
          <span className="text-[10px] text-zinc-700 font-mono hidden md:block">
            {messageCount.toLocaleString()} frames
          </span>
        )}
        <div className={`flex items-center gap-1.5 text-[10px] font-mono font-semibold tracking-wider ${s.textCls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </div>
      </div>

    </header>
  )
}
