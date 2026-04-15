# TrueMarkets Market Monitor — Technical Report

## 1. Overview

A real-time market-microstructure dashboard subscribing to the TrueMarkets
WebSocket feed and visualising the matching engine's output.  No trading logic.
No synthetic data — every widget is either populated from the live feed or shows
an explicit "waiting for feed" empty state.

---

## 2. Data Sources

Sources verified against `cli-main/internal/cli/` (Go source).

### 2.1 WebSocket — `wss://api.truemarkets.co/v1/defi/market`

Source: `cmd_price.go` — `priceWSEndpoint = "/v1/defi/market"`

Single persistent connection.  No authentication required (public market feed).
Subscription message on open:

```json
{ "type": "subscribe", "topics": ["all"] }
```

Auto-reconnects with 4-second back-off on close/error.

### 2.2 REST — `/api/assets` (Next.js proxy)

Source: `cmd_assets.go` — `GetAssetsWithResponse` with `evm=true`

Proxies `GET https://api.truemarkets.co/v1/defi/core/assets?evm=true&version=2026-01-26`.

Called once on mount to populate symbol tabs before the first WS frame.
Returns empty array gracefully (Cloudflare challenge in some environments).

---

## 3. WebSocket Message Schema

Source: `cmd_price.go` — `wsServerMessage` / `wsPriceCandle`

### Envelope

```typescript
interface WsServerMessage {
  type:      string          // "price_candles"
  timestamp: number          // unix seconds (server time)
  data?:     WsPriceCandle[]
}
```

### Per-candle shape (`data` array)

```typescript
interface WsPriceCandle {
  symbol:   string   // e.g. "BTC", "ETH", "SOL", "2Z"
  address:  string   // on-chain token contract address
  chain:    string   // "solana" | "base"
  interval: string   // "30s" | "1h" | "4h" | "24h"
  open:     string
  high:     string
  low:      string
  close:    string
}
```

### Intervals used

| Interval | Dashboard use |
|----------|---------------|
| `30s`    | Current price (mid), spread proxy (high/low), trade direction |
| `24h`    | Instrument panel — 24h OHLC, % change |

Other intervals (`1h`, `4h`) are received but not currently displayed.

### Example frame

```json
{
  "type": "price_candles",
  "timestamp": 1744682008,
  "data": [
    { "symbol": "BTC",  "chain": "solana", "interval": "30s",
      "open": "95120.0", "high": "95141.2", "low": "95108.5", "close": "95135.0" },
    { "symbol": "BTC",  "chain": "solana", "interval": "24h",
      "open": "92400.0", "high": "96000.0", "low": "91800.0", "close": "95135.0" },
    { "symbol": "ETH",  "chain": "base",   "interval": "30s",
      "open": "1820.0",  "high": "1821.5",  "low": "1819.0",  "close": "1820.8" },
    ...
  ]
}
```

---

## 4. Domain Mappings

### 4.1 30s candle → EBBOSnapshot

The price feed does not provide a traditional order book.  We derive the best
available proxy for bid/ask from the 30-second candle:

```
mid       = close          // last traded price — most meaningful current price
bid       = low            // lowest trade in window ≈ best bid proxy
ask       = high           // highest trade in window ≈ best ask proxy
spread    = ask − bid      = high − low
spreadBps = (spread / mid) × 10,000
```

**Limitation**: When no price movement occurs within a 30s window, `high === low`
and spread = 0 bps.  This is correct — it means the matching engine printed the
same price for all fills in that interval, not a data error.

### 4.2 30s candle → TradeEvent

```
price = close
side  = close >= open ? "BUY" : "SELL"   // aggressor inference from candle direction
```

**Limitation**: `qty` and `notional` are always 0 — the `price_candles` feed
does not carry volume.  Charts that require volume (VWAP, size distribution) show
`null` / empty state when qty = 0.

### 4.3 24h candle → InstrumentState

```
open24h, high24h, low24h, close24h = candle fields
change24hPct = (close24h − open24h) / open24h × 100
```

---

## 5. Dashboard Panels

### 5.1 Order Book

Displays:
- Symbol, chain, ACTIVE status pill
- Current mid price (= 30s close) in large type
- 24h % change (green/red)
- Best ask (= 30s high) / bid (= 30s low) with colour-coded depth rows
- Spread in basis points
- 24h OHLC grid from the 24h candle

### 5.2 Price Chart

Line chart of `mid` (30s close) over time, down-sampled to ≤ 200 points:

```
step = max(1, floor(historyLength / 200))
```

#### Toggleable indicator overlays

| Toggle | Formula | Color |
|--------|---------|-------|
| EMA 10 | See §5.2.1 | Amber |
| EMA 20 | See §5.2.1 | Blue |
| EMA 50 | See §5.2.1 | Violet |
| BB(20,2) | See §5.2.2 | Gray |
| VWAP | See §5.2.3 | Green |
| RSI 14 | See §5.2.4 (sub-pane) | Cyan |

#### 5.2.1 EMA — Exponential Moving Average

```
k      = 2 / (period + 1)                    # smoothing factor
EMA[0] = SMA(prices[0…period-1])             # seed = arithmetic mean of first window
EMA[t] = price[t] × k + EMA[t-1] × (1 − k)
```

Returns `null` during warm-up so Recharts renders a gap.

#### 5.2.2 Bollinger Bands — BB(20, 2)

```
SMA(t)    = (1/20) × Σ price[t−19 … t]
σ(t)      = √[ (1/20) × Σ(price[i] − SMA(t))² ]    # population std dev
Upper(t)  = SMA(t) + 2σ(t)
Middle(t) = SMA(t)
Lower(t)  = SMA(t) − 2σ(t)
```

Bands start at index 19 (first full window).

#### 5.2.3 VWAP — Volume-Weighted Average Price

```
VWAP(t) = Σ price[i] × qty[i]  /  Σ qty[i]     for all trades i where ts ≤ t
```

Returns `null` when `Σ qty = 0` (i.e. always on the `price_candles` feed which
carries no volume — widget shows correctly empty, not zero).

#### 5.2.4 RSI — Relative Strength Index (Wilder, 1978)

```
diff[i]  = price[i] − price[i-1]
gain[i]  = max(diff[i], 0)
loss[i]  = max(-diff[i], 0)

# Seed (period = 14):
avgGain  = mean(gain[1…14])
avgLoss  = mean(loss[1…14])

# Wilder smoothing:
avgGain  = (avgGain × 13 + gain[i]) / 14
avgLoss  = (avgLoss × 13 + loss[i]) / 14

RS       = avgGain / avgLoss
RSI      = 100 − 100 / (1 + RS)     ∈ [0, 100]
```

Rendered in a collapsible sub-pane beneath the price chart.
Overbought ≥ 70 (red line), oversold ≤ 30 (green line).

**Known behaviour**: when all 30s candles close ≥ open (price only rising),
avgLoss = 0 → RSI = 100.  This is mathematically correct.

### 5.3 Bid–Ask Spread

```
spreadBps(t) = (high(t) − low(t)) / close(t) × 10,000
avg          = mean(spreadBps[0…N])
delta        = latest − avg
```

Area chart with session-average reference line.  Zero spread = price flat in window.

### 5.4 Trade Frequency

30 non-overlapping 10-second buckets (5 minutes of history):

```
buckets = [ [now − 300s, now − 290s), …, [now − 10s, now) ]
buyCount(b)   = |{ trade ∈ b : side = "BUY"  }|
sellCount(b)  = |{ trade ∈ b : side = "SELL" }|
```

### 5.5 Trade Size Distribution

Log-scale histogram, 8 bins.  With `price_candles` feed, qty = 0 for all
trades — chart remains in `<NoData>` state until a feed with volume is connected.

```
logMin  = log₁₀(min_qty)
logMax  = log₁₀(max_qty)
binWidth = (logMax − logMin) / 8
bin(i)   = [ 10^(logMin + i×binWidth), 10^(logMin + (i+1)×binWidth) )
```

Bars heat-ramped dark→amber by count.

### 5.6 Volatility Clustering

Rolling 20-sample standard deviation of log-returns, annualised:

```
window  = ebboHistory[i − 20 … i]
r[j]    = ln(mid[j] / mid[j-1])
σ_raw   = √[ (1/20) × Σ(r[j] − mean(r))² ]
σ_ann   = σ_raw × √(43,200 × 252) × 100   # %
```

Assumes 1 candle per ~2s → 43,200 candles/day × 252 trading days.
Flat price → σ = 0%.  Volatility clustering visible as vol-spike regions
co-occurring with price jumps (dual-axis: σ left, mid right).

### 5.7 Live Tape

Scrolling feed of the 80 most recent trade events (30s candle close/direction).
Columns: time, price, size (0 on this feed), notional ($0.00 on this feed), side ▲/▼.

---

## 6. Data Integrity Audit

Every code path verified.  Zero synthetic random values in the render path.

| Source | Real? | Fallback when unavailable |
|--------|-------|--------------------------|
| WS `price_candles` 30s → EBBO | ✅ Real | Widget shows "Awaiting feed…" |
| WS `price_candles` 30s → Trade | ✅ Real (price/direction) | Empty tape |
| WS `price_candles` 24h → Instrument | ✅ Real | Status pill only |
| REST assets → symbol tabs | ✅ Real | No tabs until WS sends data |
| EMA / BB / RSI | Derived from real EBBO | `null` during warm-up (gap in chart) |
| VWAP | Derived from real trades | `null` (qty = 0 on this feed) |
| Trade qty / notional | ❌ Not in feed | Always 0 — displayed as-is |
| Spread when high = low | 0 bps | Correct — no movement in window |
| `seedSimulatedData()` | **Removed** | — |
| Simulation tick loop | **Removed** | — |

---

## 7. Known Feed Limitations

| Limitation | Root cause | Impact |
|-----------|-----------|--------|
| No trade volume | `price_candles` doesn't carry qty | VWAP null; size dist empty |
| Spread = 0 on flat windows | high = low when price stable in 30s | Spread chart shows 0 |
| RSI = 100 on trending asset | All candles bullish → avgLoss = 0 | Correct math, not a bug |
| Bid/ask are approximations | Using candle high/low as proxy | Not a true L1 order book |

To get true L1 EBBO, TRADE, and INSTRUMENT feeds, subscribe to the CeFi
Direct WebSocket (`wss://prod.truex.co/...`) which requires API credentials
and VPN/PrivateLink access to the TrueX matching engine.

---

## 8. File Map

```
lib/
  types.ts          WS envelope + domain types (sourced from CLI structs)
  useTrueMarkets.ts WebSocket hook + REST bootstrap; zero synthetic data
  metrics.ts        Spread, trade-freq, size-dist, volatility series
  indicators.ts     EMA, SMA, Bollinger Bands, VWAP, RSI (pure functions)

components/
  Dashboard.tsx     Layout grid + panel orchestration + NoData states
  StatusBar.tsx     Header — symbol tabs + connection status indicator
  OrderBook.tsx     Current price, 24h OHLC, bid/ask proxy
  PriceChart.tsx    Mid price + toggleable EMA/BB/VWAP + RSI sub-pane
  SpreadChart.tsx   Bid–ask spread area chart
  TradeFreqChart.tsx Buy/sell stacked bar chart (10s buckets)
  SizeDistChart.tsx  Log-scale histogram (empty on this feed)
  VolatilityChart.tsx Rolling σ + mid price dual-axis
  TradeTape.tsx     Scrolling live trade event feed

app/
  page.tsx            Entry point
  layout.tsx          HTML shell + metadata
  globals.css         Dark theme + scrollbar helpers
  api/
    assets/route.ts   GET proxy → api.truemarkets.co/v1/defi/core/assets
    instruments/      (legacy — unused, superseded by /api/assets)
```
