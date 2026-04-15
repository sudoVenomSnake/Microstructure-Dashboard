import { NextRequest } from 'next/server'
import { getCollector } from '@/lib/server/defiCollector'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * SSE endpoint — streams raw DeFi WebSocket frames to the browser.
 * The collector runs server-side, so data flows even when the tab is
 * in the background or closed.
 */
export async function GET(req: NextRequest) {
  const collector = getCollector()

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      let closed = false

      function send(raw: string) {
        if (closed) return
        try { controller.enqueue(enc.encode(`data: ${raw}\n\n`)) } catch { closed = true }
      }

      // Subscribe to live messages first
      const unsub = collector.subscribe(send)

      // Replay buffered history asynchronously so the live stream is ready first
      const snapshot = collector.getBuffer()
      setImmediate(() => { for (const msg of snapshot) send(msg) })

      req.signal.addEventListener('abort', () => {
        unsub()
        closed = true
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
