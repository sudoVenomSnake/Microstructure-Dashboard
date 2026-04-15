import { NextResponse } from 'next/server'

// Try real CeFi prod, fall back to the public mock (same schema).
// prod.truex.co is behind VPN/PrivateLink in most deployments, so the mock
// is a valid fallback for local/dev use — it returns the same JSON shape.
const PROD = 'https://prod.truex.co/api/v1/instruments'
const MOCK = 'https://docs.truemarkets.co/_mock/apis/cefi-direct/rest/v1/api/v1/instruments'

export async function GET() {
  // Try production first (short timeout so we don't block the UI)
  try {
    const res = await fetch(PROD, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(3_000),
    })
    if (res.ok) {
      const raw = await res.json()
      return NextResponse.json(normalise(raw))
    }
  } catch { /* prod unreachable — fall through */ }

  // Fall back to mock
  try {
    const res = await fetch(MOCK, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5_000),
    })
    if (res.ok) {
      const raw = await res.json()
      return NextResponse.json(normalise(raw))
    }
  } catch { /* mock also failed */ }

  // Nothing available — return empty; UI will show "no data" states
  return NextResponse.json([])
}

// Normalise both prod and mock shapes into {id, symbol, status, ...stats}
function normalise(raw: unknown[]): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return []
  return raw.map(item => {
    const r = item as Record<string, unknown>
    const info = (r.info as Record<string, unknown>) || {}
    const stats = (r.stats as Record<string, unknown>) || {}
    return {
      id: r.id,
      symbol: (r.symbol as string) || (info.symbol as string) || '',
      status: r.status,
      reference_price: info.reference_price,
      price_limit_percent: info.price_limit_percent,
      last_24hr_notional: stats.last_24hr_notional,
      last_24hr_quantity: stats.last_24hr_quantity,
    }
  }).filter(r => r.symbol)
}
