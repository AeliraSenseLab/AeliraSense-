
import fetch from 'node-fetch'

export interface TokenMetrics {
  priceUsd: number
  volume24h: number
  holderCount: number
}

export interface AnalysisResult {
  mint: string
  metrics: TokenMetrics
  score: number        // custom risk/health score 0–1
  timestamp: number
}

/**
 * Core analysis engine: fetches on-chain and market data, computes a score.
 */
export class AnalysisCore {
  constructor(private readonly rpcUrl: string) {}

  private async fetchMarketData(mint: string): Promise<Pick<TokenMetrics, 'priceUsd' | 'volume24h'>> {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${mint}`)
    if (!res.ok) throw new Error(`Market data failed: ${res.status}`)
    const json = await res.json() as any
    return {
      priceUsd: parseFloat(json.pair.priceUsd),
      volume24h: parseFloat(json.pair.volumeUsd24Hr)
    }
  }

  private async fetchHolderCount(mint: string): Promise<number> {
    const res = await fetch(`https://public-api.solscan.io/token/holders?tokenAddress=${mint}&limit=1`)
    if (!res.ok) throw new Error(`Holder data failed: ${res.status}`)
    const data = await res.json() as any[]
    return data[0]?.totalHolderCount ?? data.length
  }

  /**
   * Runs full analysis for a given token mint.
   */
  public async analyze(mint: string): Promise<AnalysisResult> {
    const [market, holders] = await Promise.all([
      this.fetchMarketData(mint),
      this.fetchHolderCount(mint)
    ])

    const metrics: TokenMetrics = {
      ...market,
      holderCount: holders
    }

    // simple score: normalize volume and holderCount against some max caps
    const score = Math.min(1, (metrics.volume24h / 1e7) * 0.5 + (metrics.holderCount / 1000) * 0.5)

    return {
      mint,
      metrics,
      score: parseFloat(score.toFixed(3)),
      timestamp: Date.now()
    }
  }
}
