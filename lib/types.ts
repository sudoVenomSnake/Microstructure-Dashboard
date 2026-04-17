// ─── Real WS envelope from wss://api.truemarkets.co/v1/defi/market ──────────
// Source: cli-main/internal/cli/cmd_price.go  wsServerMessage / wsPriceCandle

export interface WsServerMessage {
  type:      string        // e.g. "price_candles"
  timestamp: number        // unix seconds
  data?:     WsPriceCandle[]
}

export interface WsPriceCandle {
  symbol:   string         // e.g. "BTC", "ETH", "SOL"
  address:  string         // on-chain token address
  chain:    string         // "solana" | "base"
  interval: string         // "30s" | "24h" | "1h" | "4h"
  open:     string
  high:     string
  low:      string
  close:    string
}

// ─── Normalised domain types ───────────────────────────────────────────────────

export interface EBBOSnapshot {
  ts:         number        // unix ms (client receive time)
  symbol:     string
  bid:        number        // low of 30s candle (best proxy for bid)
  ask:        number        // high of 30s candle (best proxy for ask)
  spread:     number        // ask − bid
  spreadBps:  number        // spread / mid × 10,000
  mid:        number        // close of 30s candle (last traded price)
  open:       number        // open of 30s candle
  bidQty:     number        // not available from price feed — always 0
  askQty:     number
  bidOrders:  number
  askOrders:  number
}

export interface TradeEvent {
  ts:       number
  symbol:   string
  price:    number          // close of 30s candle
  qty:      number          // not available — 0
  notional: number          // 0 unless volume available
  side:     'BUY' | 'SELL' // derived: close >= open → BUY
}

export interface InstrumentState {
  symbol:              string
  chain:               string   // "solana" | "base" | "cefi"
  address:             string
  status:              string
  open24h:             number
  high24h:             number
  low24h:              number
  close24h:            number
  change24hPct:        number   // (close − open) / open × 100
  updatedAt:           number
  volume24hNotional?:  number   // CeFi only — last_24hr_notional
  volume24hQty?:       number   // CeFi only — last_24hr_quantity
}

export interface SymbolState {
  instrument:  InstrumentState | null
  ebboHistory: EBBOSnapshot[]
  tradeHistory: TradeEvent[]
  latestEBBO:  EBBOSnapshot | null
  candles30s:  CandleData[]   // one entry per 30-second period
  candles1m:   CandleData[]   // one entry per 1-minute period
  candles5m:   CandleData[]   // one entry per 5-minute period
}

export type DashboardState = Record<string, SymbolState>

// ─── Derived chart types ───────────────────────────────────────────────────────

export interface SpreadPoint {
  ts:         number
  time:       string
  spreadBps:  number
  spread:     number
}

export interface TradeFreqBucket {
  time:      string
  count:     number
  buyCount:  number
  sellCount: number
}

export interface SizeBucket {
  range: string
  count: number
  pct:   number
}

export interface VolatilityPoint {
  ts:         number
  time:       string
  rollingVol: number
  midPrice:   number
}

export interface RollSpreadPoint {
  ts:        number
  time:      string
  rollBps:   number   // Roll (1984): 2√(−Cov(Δr_t, Δr_{t−1})) × 10,000
  midPrice:  number
}

export interface CandleData {
  ts:        number    // bucket start (ms)
  time:      string    // formatted HH:MM:SS
  open:      number
  high:      number
  low:       number
  close:     number
  isBull:    boolean   // close >= open
  isForming: boolean   // latest (still-forming) candle
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export type RawMessage = WsServerMessage | Record<string, unknown>

export interface Asset {
  symbol:            string
  chain:             string
  address:           string
  name:              string
  description:       string
  website:           string
  icon:              string
  twitterUrl:        string
  redditUrl:         string
  circulatingSupply: number
  totalSupply:       number
  maxSupply:         number
  stable:            boolean
  tradeable:         boolean
}
