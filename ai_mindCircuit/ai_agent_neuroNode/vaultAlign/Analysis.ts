
import { AeliraSenseEngine } from './aeliraSenseEngine'

export interface OnChainMetric {
  timestamp: number
  volume: number
  liquidity: number
  activeAddresses: number
}

export interface CorrelationResult {
  pair: readonly [keyof OnChainMetric, keyof OnChainMetric]
  coefficient: number
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0 || y.length !== n) return 0

  const meanX = x.reduce((s, v) => s + v, 0) / n
  const meanY = y.reduce((s, v) => s + v, 0) / n

  let num = 0, denomX = 0, denomY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    num    += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }
  const denom = Math.sqrt(denomX * denomY)
  return denom === 0 ? 0 : num / denom
}


export class CorrelationAnalyzer {
  private engine: AeliraSenseEngine

  constructor(apiUrl: string, apiKey: string) {
    this.engine = new AeliraSenseEngine(apiUrl, apiKey)
  }


  public async analyze(
    tokenMint: string,
    periodHours: number
  ): Promise<CorrelationResult[]> {
    const metrics = await this.engine.fetchMetrics(tokenMint, periodHours) as OnChainMetric[]
    if (metrics.length < 2) return []

    const volumeSeries    = metrics.map(m => m.volume)
    const liquiditySeries = metrics.map(m => m.liquidity)
    const activeSeries    = metrics.map(m => m.activeAddresses)

    const pairs: Array<[keyof OnChainMetric, keyof OnChainMetric, number[], number[]]> = [
      ['volume', 'liquidity', volumeSeries, liquiditySeries],
      ['volume', 'activeAddresses', volumeSeries, activeSeries],
      ['liquidity', 'activeAddresses', liquiditySeries, activeSeries],
    ]

    return pairs.map(([a, b, seriesA, seriesB]) => ({
      pair: [a, b],
      coefficient: parseFloat(pearsonCorrelation(seriesA, seriesB).toFixed(4))
    }))
  }
}