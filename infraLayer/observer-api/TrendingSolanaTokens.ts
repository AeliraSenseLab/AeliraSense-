

import fetch from 'node-fetch'

export interface TrendingToken {
  source: string
  symbol: string
  mint: string
  change24h?: number
}

/**
 * Fetch trending Solana tokens from different trackers (Coingecko & SolanaFM)
 */
export async function fetchTrendingSolanaTokens(): Promise<TrendingToken[]> {
  const trending: TrendingToken[] = []

  // 1) Coingecko trending API
  try {
    const cgRes = await fetch('https://api.coingecko.com/api/v3/search/trending')
    const cgJson = await cgRes.json() as any
    cgJson.coins.forEach((c: any) => {
      if (c.item.platforms.solana) {
        trending.push({
          source: 'Coingecko',
          symbol: c.item.symbol,
          mint: c.item.platforms.solana
        })
      }
    })
  } catch (err) {
    console.warn('Coingecko trending failed:', err)
  }

  // 2) SolanaFM trending (unofficial)
  try {
    const sfmRes = await fetch('https://api.solana.fm/v0/tokens/trending')
    const sfmJson = await sfmRes.json() as any
    sfmJson.data.forEach((t: any) => {
      trending.push({
        source: 'SolanaFM',
        symbol: t.symbol,
        mint: t.mint,
        change24h: t.change_24h
      })
    })
  } catch (err) {
    console.warn('SolanaFM trending failed:', err)
  }

  return trending
}
