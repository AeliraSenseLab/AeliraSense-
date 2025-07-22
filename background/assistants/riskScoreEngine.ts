import { Connection, PublicKey } from '@solana/web3.js'
import fetch from 'node-fetch'

export interface RiskFactors {
  velocity: number      // transfers per minute
  concentration: number // Gini coefficient of holdings
  volatility: number    // price volatility %
}

export interface RiskScore {
  mint: string
  score: number         // 0.0 (low) → 1.0 (extreme)
  factors: RiskFactors
  timestamp: number
}

export class RiskScoreEngine {
  constructor(private rpcUrl: string, private dexChain = 'solana') {}

  private async fetchVelocity(mint: string): Promise<number> {
    // fetch last 60 transfers and compute per-minute rate
    const res = await fetch(
      `https://public-api.solscan.io/account/token/txs?account=${mint}&limit=60`
    )
    const data = (await res.json()).data as any[]
    const now = Date.now() / 1000
    const times = data.map(tx => tx.blockTime || now)
    const earliest = Math.min(...times)
    const span = now - earliest || 1
    return data.length / (span / 60)
  }

  private async fetchConcentration(mint: string): Promise<number> {
    // reuse simple Gini from distributionTracer
    const holdersRes = await fetch(
      `https://public-api.solscan.io/token/holders?tokenAddress=${mint}&limit=1000`
    )
    const holders = (await holdersRes.json()) as any[]
    const balances = holders.map(h => Number(h.tokenAmount))
    balances.sort((a, b) => a - b)
    const n = balances.length
    const total = balances.reduce((s, v) => s + v, 0) || 1
    const cum = balances.reduce((s, v, i) => s + v * (i + 1), 0)
    const gini = (2 * cum) / (n * total) - (n + 1) / n
    return Math.min(Math.max(gini, 0), 1)
  }

  private async fetchVolatility(mint: string): Promise<number> {
    // simple 1h volatility pulse
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/${this.dexChain}/${mint}?include=ohlcv`
    )
    const raw = ((await res.json()) as any).pair.ohlcv as any[]
    const closes = raw.filter(r => r[6] === '1h').map(r => parseFloat(r[4]))
    const mean = closes.reduce((a, b) => a + b, 0) / closes.length || 0
    const variance = closes.reduce((a, b) => a + (b - mean) ** 2, 0) / closes.length || 0
    return mean > 0 ? Math.sqrt(variance) / mean : 0
  }

  public async score(mint: string): Promise<RiskScore> {
    const [velocity, concentration, volatility] = await Promise.all([
      this.fetchVelocity(mint),
      this.fetchConcentration(mint),
      this.fetchVolatility(mint)
    ])

    // simple weighted sum, normalized
    const score = Math.min(
      1,
      (velocity / 10) * 0.3 + concentration * 0.4 + volatility * 0.3
    )

    return {
      mint,
      score: parseFloat(score.toFixed(3)),
      factors: { velocity, concentration, volatility },
      timestamp: Date.now()
    }
  }
}
