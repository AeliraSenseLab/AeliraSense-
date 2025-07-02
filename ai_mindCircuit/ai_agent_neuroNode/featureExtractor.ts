

export interface TimePoint {
  timestamp: number   
  price: number       
  volume: number      
}

export interface FeatureVector {
  timestamp: number
  smaFast: number
  smaMid: number
  smaSlow: number
  momentum: number
  volatility: number
}

export class FeatureExtractor {
  constructor(
    private readonly fastWindow: number = 5,
    private readonly midWindow: number = 15,
    private readonly slowWindow: number = 30
  ) {}

  private sma(prices: number[], window: number): number {
    const slice = prices.slice(-window)
    if (!slice.length) return 0
    return slice.reduce((sum, p) => sum + p, 0) / slice.length
  }

  private momentum(prices: number[]): number {
    if (prices.length < 2) return 0
    return prices[prices.length - 1] - prices[0]
  }

  private volatility(prices: number[]): number {
    if (!prices.length) return 0
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length
    const variance = prices
      .map(p => (p - mean) ** 2)
      .reduce((sum, v) => sum + v, 0) / prices.length
    return Math.sqrt(variance)
  }


  public extract(points: TimePoint[]): FeatureVector {
    const prices = points.map(p => p.price)
    const latestTs = points[points.length - 1]?.timestamp || Date.now()

    return {
      timestamp: latestTs,
      smaFast: this.sma(prices, this.fastWindow),
      smaMid:  this.sma(prices, this.midWindow),
      smaSlow: this.sma(prices, this.slowWindow),
      momentum: this.momentum(prices.slice(-this.midWindow)),
      volatility: this.volatility(prices.slice(-this.slowWindow))
    }
  }
}
