

import fetch from 'node-fetch'

export interface PairInfo {
  dex: string
  baseMint: string
  quoteMint: string
  marketAddress?: string
  poolAddress?: string
}

/**
 * Fetch token pairs from multiple Solana DEXes (Serum & Raydium)
 */
export async function fetchDexTokenPairs(): Promise<PairInfo[]> {
  const results: PairInfo[] = []

  // 1) Serum markets
  try {
    const serumRes = await fetch('https://api.serum-v2.mainnet.rpcpool.com/markets')
    const serumMarkets = (await serumRes.json()) as any[]
    serumMarkets.forEach(m => {
      results.push({
        dex: 'Serum',
        baseMint: m.baseMint,
        quoteMint: m.quoteMint,
        marketAddress: m.address
      })
    })
  } catch (err) {
    console.warn('Serum fetch failed:', err)
  }

  // 2) Raydium pools
  try {
    const rayRes = await fetch('https://api.raydium.io/v2/main/pairs')
    const rayPools = (await rayRes.json()) as any[]
    rayPools.forEach(p => {
      results.push({
        dex: 'Raydium',
        baseMint: p.baseMint,
        quoteMint: p.quoteMint,
        poolAddress: p.ammId
      })
    })
  } catch (err) {
    console.warn('Raydium fetch failed:', err)
  }

  return results
}
