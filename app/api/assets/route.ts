import { NextResponse } from 'next/server'

// Source: cli-main/internal/cli/client.go + cmd_assets.go
// GET /v1/defi/core/assets?evm=true&version=2026-01-26
// Returns array of Asset objects with symbol, chain, address, name, etc.

const API_HOST    = 'https://api.truemarkets.co'
const API_VERSION = '2026-01-26'
const ASSETS_URL  = `${API_HOST}/v1/defi/core/assets?evm=true&version=${API_VERSION}`

export async function GET() {
  try {
    const res = await fetch(ASSETS_URL, {
      headers: { 'User-Agent': 'tm/dashboard' },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5_000),
    })

    if (!res.ok) {
      return NextResponse.json([], { status: 200 })
    }

    const raw: unknown[] = await res.json()
    if (!Array.isArray(raw)) return NextResponse.json([])

    // Return full asset shape
    const assets = raw
      .map((a: unknown) => {
        const item = a as Record<string, unknown>
        return {
          symbol:      item.symbol as string || '',
          chain:       item.chain as string || '',
          address:     item.address as string || '',
          name:        item.name as string || '',
          description: item.description as string || '',
          website:     item.website as string || '',
          icon:        (item.image as any)?.thumb as string || '',
          twitterUrl:  (item.socials as any)?.x_username ? `https://x.com/${(item.socials as any).x_username}` : '',
          redditUrl:   (item.socials as any)?.subreddit_url as string || '',
          circulatingSupply: Number(item.circulating_supply) || 0,
          totalSupply:       Number(item.total_supply) || 0,
          maxSupply:         Number(item.max_supply) || 0,
          stable:      Boolean(item.stable),
          tradeable:   Boolean(item.tradeable),
        }
      })
      .filter(a => a.symbol)

    return NextResponse.json(assets)
  } catch {
    // Network error (Cloudflare challenge, timeout, etc.) — return empty
    return NextResponse.json([])
  }
}
