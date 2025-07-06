import fetch, { RequestInit } from "node-fetch"

export interface TrendingToken {
  source: string
  symbol: string
  mint: string
  change24h?: number
}

interface SourceConfig {
  name: string
  url: string
  parser: (json: any) => Array<Omit<TrendingToken, "source">>
  timeoutMs: number
  retries: number
}

const cache = new Map<string, { data: TrendingToken[]; expiresAt: number }>()

/** Default 5-minute cache */
const DEFAULT_TTL_MS = 5 * 60 * 1000

/** Helper: fetch with timeout + retries */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retries: number
): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) throw new Error(`Status ${res.status}`)
      return res.json()
    } catch (err) {
      clearTimeout(timer)
      if (attempt === retries) throw err
    }
  }
}

/** Source definitions */
const SOURCES: SourceConfig[] = [
  {
    name: "Coingecko",
    url: "https://api.coingecko.com/api/v3/search/trending",
    timeoutMs: 3000,
    retries: 1,
    parser: (json) =>
      Array.isArray(json.coins)
        ? json.coins
            .map((c: any) => ({
              symbol: c?.item?.symbol,
              mint: c?.item?.platforms?.solana,
            }))
            .filter((t: any) => t.symbol && t.mint)
        : [],
  },
  {
    name: "SolanaFM",
    url: "https://api.solana.fm/v0/tokens/trending",
    timeoutMs: 3000,
    retries: 1,
    parser: (json) =>
      Array.isArray(json.data)
        ? json.data
            .map((t: any) => ({
              symbol: t.symbol,
              mint: t.mint,
              change24h:
                typeof t.change_24h === "number" ? t.change_24h : undefined,
            }))
            .filter((t: any) => t.symbol && t.mint)
        : [],
  },
]

/**
 * Fetch trending Solana tokens from multiple sources.
 * Results are cached for TTL (default 5m).
 */
export async function fetchTrendingSolanaTokens(
  ttlMs = DEFAULT_TTL_MS
): Promise<TrendingToken[]> {
  const cacheKey = `trending_${ttlMs}`
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.data
  }

  const seen = new Set<string>()
  const trending: TrendingToken[] = []

  await Promise.all(
    SOURCES.map(async (src) => {
      try {
        const json = await fetchWithTimeout(
          src.url,
          { headers: { "Accept": "application/json" } },
          src.timeoutMs,
          src.retries
        )
        for (const token of src.parser(json)) {
          if (!seen.has(tok
