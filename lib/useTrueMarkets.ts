'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Asset,
  ConnectionStatus,
  DashboardState,
  EBBOSnapshot,
  TradeEvent,
  InstrumentState,
  SymbolState,
  WsServerMessage,
  WsPriceCandle,
} from './types'

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_EBBO_HISTORY  = 500
const MAX_TRADE_HISTORY = 500
const RECONNECT_DELAY   = 4_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(s: string | undefined): number {
  if (!s) return 0
  const v = parseFloat(s)
  return isNaN(v) ? 0 : v
}

function emptySymbol(): SymbolState {
  return { instrument: null, ebboHistory: [], tradeHistory: [], latestEBBO: null }
}

// ─── Parse one WsPriceCandle into our domain types ───────────────────────────

function candleToEBBO(c: WsPriceCandle, ts: number): EBBOSnapshot | null {
  const close = n(c.close)
  const open  = n(c.open)
  const high  = n(c.high)
  const low   = n(c.low)
  if (!close) return null

  const bid    = low  || close
  const ask    = high || close
  const mid    = close
  const spread = Math.max(ask - bid, 0)
  const spreadBps = mid > 0 ? (spread / mid) * 10_000 : 0

  return {
    ts,
    symbol:    c.symbol,
    bid, ask, mid, open,
    spread, spreadBps,
    bidQty: 0, askQty: 0, bidOrders: 0, askOrders: 0,
  }
}

function candleTo24hInstrument(c: WsPriceCandle, ts: number): InstrumentState {
  const open  = n(c.open)
  const close = n(c.close)
  const change = open > 0 ? ((close - open) / open) * 100 : 0
  return {
    symbol:       c.symbol,
    chain:        c.chain,
    address:      c.address,
    status:       'ACTIVE',
    open24h:      open,
    high24h:      n(c.high),
    low24h:       n(c.low),
    close24h:     close,
    change24hPct: change,
    updatedAt:    ts,
  }
}

function candleToTrade(c: WsPriceCandle, ts: number): TradeEvent | null {
  const price = n(c.close)
  const open  = n(c.open)
  if (!price) return null
  return {
    ts,
    symbol:   c.symbol,
    price,
    qty:      0,
    notional: 0,
    side:     price >= open ? 'BUY' : 'SELL',
  }
}

// ─── Apply one WS frame onto state ────────────────────────────────────────────

function applyMessage(state: DashboardState, raw: WsServerMessage): DashboardState {
  if (raw.type !== 'price_candles') return state
  if (!raw.data?.length) return state

  const ts = raw.timestamp ? raw.timestamp * 1_000 : Date.now()

  type BySymbol = Record<string, Record<string, WsPriceCandle>>
  const grouped: BySymbol = {}
  for (const c of raw.data) {
    if (!c.symbol) continue
    if (!grouped[c.symbol]) grouped[c.symbol] = {}
    grouped[c.symbol][c.interval] = c
  }

  let next = state
  for (const [sym, intervals] of Object.entries(grouped)) {
    const cur = { ...(next[sym] ?? emptySymbol()) }

    const c30 = intervals['30s']
    if (c30) {
      const snap = candleToEBBO(c30, ts)
      if (snap) {
        cur.latestEBBO  = snap
        cur.ebboHistory = [...cur.ebboHistory.slice(-(MAX_EBBO_HISTORY - 1)), snap]
        const trade = candleToTrade(c30, ts)
        if (trade) {
          cur.tradeHistory = [...cur.tradeHistory.slice(-(MAX_TRADE_HISTORY - 1)), trade]
        }
      }
    }

    const c24 = intervals['24h']
    if (c24) {
      cur.instrument = candleTo24hInstrument(c24, ts)
    }

    next = { ...next, [sym]: cur }
  }

  return next
}

// ─── REST: fetch asset list ───────────────────────────────────────────────────

async function fetchAssets(): Promise<Asset[]> {
  try {
    const res = await fetch('/api/assets', { signal: AbortSignal.timeout(5_000) })
    if (res.ok) {
      const data: Asset[] = await res.json()
      return data.filter(a => a.symbol)
    }
  } catch { /* fall through */ }
  return []
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTrueMarkets() {
  const [state, setState]           = useState<DashboardState>({})
  const [status, setStatus]         = useState<ConnectionStatus>('connecting')
  const [messageCount, setMsgCount] = useState(0)
  const [assets, setAssets]         = useState<Record<string, Asset>>({})

  const esRef          = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef     = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    // Pre-register known symbols from REST
    fetchAssets().then(fetched => {
      if (!mountedRef.current || !fetched.length) return
      const assetMap: Record<string, Asset> = {}
      for (const a of fetched) assetMap[a.symbol] = a
      setAssets(assetMap)
      setState(prev => {
        const next = { ...prev }
        for (const a of fetched) {
          if (!next[a.symbol]) next[a.symbol] = emptySymbol()
        }
        return next
      })
    })

    function connect() {
      if (!mountedRef.current) return
      setStatus('connecting')

      const es = new EventSource('/api/defi-stream')
      esRef.current = es

      es.onopen = () => {
        if (!mountedRef.current) return
        setStatus('connected')
      }

      es.onmessage = (ev) => {
        if (!mountedRef.current) return
        try {
          const raw: WsServerMessage = JSON.parse(ev.data as string)
          setState(prev => applyMessage(prev, raw))
          setMsgCount(c => c + 1)
        } catch { /* malformed frame */ }
      }

      es.onerror = () => {
        if (!mountedRef.current) return
        setStatus('error')
        es.close()
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      esRef.current?.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [])

  const symbols = Object.keys(state).filter(Boolean)
  return { state, status, messageCount, symbols, assets }
}
