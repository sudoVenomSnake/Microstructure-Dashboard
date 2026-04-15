/**
 * Server-side DeFi WebSocket collector.
 * Runs as a singleton in the Next.js Node.js process — persists as long as
 * the dev/prod server is running, regardless of browser tab visibility.
 *
 * Uses the global trick so Next.js Fast-Refresh hot-reloads don't restart it.
 */

import WebSocket from 'ws'

type Listener = (raw: string) => void

const WS_URL        = 'wss://api.truemarkets.co/v1/defi/market'
const RECONNECT_MS  = 4_000
const BUFFER_SIZE   = 1_000   // keep last 1000 messages in memory

class DefiCollector {
  private ws: WebSocket | null = null
  private listeners           = new Set<Listener>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private buffer: string[]    = []
  public  status: 'connecting' | 'connected' | 'disconnected' = 'connecting'

  constructor() { this.connect() }

  private connect() {
    this.status = 'connecting'
    const ws = new WebSocket(WS_URL, { headers: { 'User-Agent': 'tm/dashboard' } })
    this.ws = ws

    ws.on('open', () => {
      this.status = 'connected'
      ws.send(JSON.stringify({ type: 'subscribe', topics: ['all'] }))
      console.log('[defi-collector] connected')
    })

    ws.on('message', (data) => {
      const raw = data.toString()
      // Always buffer — regardless of whether any browser is connected
      this.buffer.push(raw)
      if (this.buffer.length > BUFFER_SIZE) this.buffer.shift()
      this.listeners.forEach(fn => fn(raw))
    })

    ws.on('close', () => {
      this.status = 'disconnected'
      console.log('[defi-collector] disconnected — reconnecting in', RECONNECT_MS, 'ms')
      this.timer = setTimeout(() => this.connect(), RECONNECT_MS)
    })

    ws.on('error', (err) => {
      console.error('[defi-collector] error:', err.message)
      // close event fires after error, which triggers reconnect
    })
  }

  /** Subscribe to live messages only. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Snapshot of buffered messages collected while no client was connected. */
  getBuffer(): string[] { return this.buffer.slice() }

  get bufferedCount() { return this.buffer.length }
}

// ─── Global singleton (survives HMR) ─────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __defiCollector: DefiCollector | undefined
}

export function getCollector(): DefiCollector {
  if (!global.__defiCollector) {
    global.__defiCollector = new DefiCollector()
  }
  return global.__defiCollector
}
