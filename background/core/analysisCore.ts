import fetch, { Headers } from 'node-fetch'
import { PublicKey } from '@solana/web3.js'

export interface TokenMetrics {
  priceUsd: number
  volume24h: number
  holderCount: number
}

export interface AnalysisResult {
  mint: string
  metrics: TokenMetrics
  score: number // 0–1
  timestamp: number
}

export interface AnalysisOptions {
  timeoutMs?: number
  retryAttempts?: number
  retryDelayMs?: number
  userAgent?: string
  dexscreenerBase?: string
  solscanBase?: string
  /**
   * Optional custom scoring function. Must return a value in [0, 1]
   */
  scorer?: (m: TokenMetrics) => number
}

type MarketShape =
  | { pairs?: Array<any> } // dexscreener common shape
  | { pair?: any } // legacy single object fallback

const DEFAULTS: Required<Omit<AnalysisOptions, 'scorer'>> = {
  timeoutMs: 8_000,
  retryAttempts: 2,
  retryDelayMs: 400,
  userAgent: 'Aelira/AnalysisCore (+https://aelira.tools)',
  dexscreenerBase: 'https://api.dexscreener.com/latest/dex/pairs/solana/',
  solscanBase: 'https://public-api.solscan.io/token/holders?limit=1&tokenAddress='
}

/**
 * Core analysis engine: fetches on-chain and market data, computes a score
 * - Deterministic linear backoff (no randomness)
 * - Defensive JSON parsing against API shape changes
 * - Input validation for mint address
 */
export class AnalysisCore {
  private readonly opts: Required<Omit<AnalysisOptions, 'scorer'>> & Pick<AnalysisOptions, 'scorer'>

  constructor(private readonly rpcUrl: string, options: AnalysisOptions = {}) {
    this.opts = { ...DEFAULTS, ...options }
  }

  public async analyze(mintStr: string): Promise<AnalysisResult> {
    const mint = this.toPublicKey(mintStr)
    const [market, holders] = await Promise.all([
      this.fetchMarketData(mint.toBase58()),
      this.fetchHolderCount(mint.toBase58())
    ])

    const metrics: TokenMetrics = { ...market, holderCount: holders }

    const score = this.clamp01(
      this.opts.scorer
        ? this.opts.scorer(metrics)
        : // default scorer: weighted linear blend with soft caps
          0.55 * Math.min(1, metrics.volume24h / 10_000_000) +
          0.45 * Math.min(1, metrics.holderCount / 1_500)
    )

    return {
      mint: mint.toBase58(),
      metrics,
      score: Number(score.toFixed(3)),
      timestamp: Date.now()
    }
  }

  // ---------- Internal: data fetchers ----------

  private async fetchMarketData(mint: string): Promise<Pick<TokenMetrics, 'priceUsd' | 'volume24h'>> {
    const url = this.opts.dexscreenerBase + mint
    const json = await this.getJsonWithRetry<MarketShape>(url)

    // Dexscreener usually returns { pairs: [ ... ] }, pick the most liquid pair
    const pair =
      Array.isArray((json as any).pairs) && (json as any).pairs.length
        ? (json as any).pairs.sort((a: any, b: any) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))[0]
        : (json as any).pair

    if (!pair) {
      // No market found — return zeros
      return { priceUsd: 0, volume24h: 0 }
    }

    // Price and volume fields vary; normalize safely
    const priceUsd = this.safeNum(
      pair.priceUsd ?? pair.price?.usd ?? pair.priceUSD ?? pair.price,
      0
    )

    const volume24h = this.safeNum(
      pair.volume?.h24 ?? pair.volumeUsd24Hr ?? pair.volume24h ?? pair.volumeUsd ?? 0,
      0
    )

    return { priceUsd, volume24h }
  }

  private async fetchHolderCount(mint: string): Promise<number> {
    const url = this.opts.solscanBase + encodeURIComponent(mint)
    const res = await this.fetchWithTimeout(url)

    // Handle rate limiting explicitly
    if (res.status === 429) {
      throw new Error('Solscan rate limited (429)')
    }
    if (!res.ok) {
      throw new Error(`Solscan failed: ${res.status}`)
    }

    // Solscan returns an array of holders; some deployments return an object
    const body = await res.json()
    if (Array.isArray(body)) {
      // totalHolderCount may be present in first element, otherwise fall back to array length
      const total = this.safeNum(body[0]?.totalHolderCount, body.length)
      return Math.max(0, Math.floor(total))
    }
    if (body && typeof body === 'object') {
      // Alternative shapes (defensive)
      const total =
        this.safeNum((body as any).totalHolder, 0) ||
        this.safeNum((body as any).totalHolderCount, 0) ||
        this.safeNum((body as any).count, 0)
      return Math.max(0, Math.floor(total))
    }
    return 0
  }

  // ---------- Internal: HTTP utilities ----------

  private async getJsonWithRetry<T = any>(url: string): Promise<T> {
    return this.callWithRetry(async () => {
      const res = await this.fetchWithTimeout(url)
      if (res.status === 429) throw new Error('Rate limited (429)')
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return (await res.json()) as T
    })
  }

  private async fetchWithTimeout(url: string) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), this.opts.timeoutMs)
    try {
      return await fetch(url, {
        method: 'GET',
        headers: new Headers({ 'user-agent': this.opts.userAgent }),
        signal: controller.signal
      } as any)
    } finally {
      clearTimeout(id)
    }
  }

  private async callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown
    for (let attempt = 0; attempt <= this.opts.retryAttempts; attempt++) {
      try {
        return await fn()
      } catch (e) {
        lastErr = e
        if (attempt < this.opts.retryAttempts) {
          await this.delay(this.opts.retryDelayMs * (attempt + 1))
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
    }

  // ---------- Internal: helpers ----------

  private toPublicKey(input: string): PublicKey {
    try {
      return new PublicKey(input)
    } catch {
      throw new Error(`Invalid mint address: ${input}`)
    }
  }

  private safeNum(v: unknown, fallback = 0): number {
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
    return Number.isFinite(n) ? n : fallback
  }

  private clamp01(x: number): number {
    return x < 0 ? 0 : x > 1 ? 1 : x
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
