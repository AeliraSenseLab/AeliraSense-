// /tokendata/tokenSpreadCalculator.ts

import fetch from 'node-fetch'

export interface PriceTick {
  source: string
  price: number
}

export interface SpreadResult {
  baseMint: string
  quoteMint: string
  bestBid: PriceTick
  bestAsk: PriceTick
  spreadPct: number
  timestamp: number
}

/**
 * Queries multiple DEX APIs for a given pair and computes the spread.
 */
export class TokenSpreadCalculator {
  private dexEndpoints: Record<string, (base: string, quote: string) => string> = {
    DexScreener: (b, q) => `https://api.dexscreener.com/latest/dex/pairs/solana/${b}/${q}`,
    Jupiter:      (b, q) => `https://quote-api.jup.ag/v1/price?inputMint=${b}&outputMint=${q}`,
    Raydium:     (b, q) => `https://api.raydium.io/v2/main/amm/price?baseMint=${b}&quoteMint=${q}`,
  }

  /**
   * Fetch a price from a DEX endpoint, normalized to a number.
   */
  private async fetchPrice(source: string, url: string): Promise<number> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${source} failed: ${res.status}`)
    const json = (await res.json()) as any

    switch (source) {
      case 'DexScreener':
        return parseFloat(json.pair.priceUsd)
      case 'Jupiter':
        return parseFloat(json.data.price)
      case 'Raydium':
        return parseFloat(json.price)  // Raydium returns { price: string }
      default:
        throw new Error(`Unknown source ${source}`)
    }
  }

  /**
   * Compute the best bid/ask across endpoints and the percentage spread.
   */
  public async computeSpread(
    baseMint: string,
    quoteMint: string
  ): Promise<SpreadResult> {
    const ticks: PriceTick[] = []

    await Promise.all(
      Object.entries(this.dexEndpoints).map(async ([source, fn]) => {
        try {
          const price = await this.fetchPrice(source, fn(baseMint, quoteMint))
          ticks.push({ source, price })
        } catch {
          // skip failures
        }
      })
    )

    if (ticks.length === 0) {
      throw new Error('No price sources available')
    }

    // For simplicity, treat all as mid-quote. Best bid= max price, best ask = min price
    const bestBid = ticks.reduce((a, b) => (b.price > a.price ? b : a))
    const bestAsk = ticks.reduce((a, b) => (b.price < a.price ? b : a))
    const spreadPct = ((bestBid.price - bestAsk.price) / bestAsk.price) * 100

    return {
      baseMint,
      quoteMint,
      bestBid,
      bestAsk,
      spreadPct: parseFloat(spreadPct.toFixed(2)),
      timestamp: Date.now(),
    }
  }
}
