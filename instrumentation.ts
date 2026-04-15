/**
 * Next.js instrumentation hook — runs once at server startup.
 * Starts the DeFi WebSocket collector so data flows even before
 * any browser tab has connected.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getCollector } = await import('./lib/server/defiCollector')
    getCollector()
    console.log('[instrumentation] DeFi collector started — buffering up to 1000 messages in background')
  }
}
