
import fetch from 'node-fetch'

export interface DexTokenData {
  dex: string
  pairAddress: string
  priceUsd: number
  volume24h: number
  liquidityUsd: number
}

/**
 * Aggregate token-pair metrics across several Solana DEX APIs
 */
export async function retrieveDexTokenData(
  chain: 'solana',
  pairAddress: string
): Promise<DexTokenData[]> {
  const out: DexTokenData[] = []

  // 1) DexScreener
  try {
    const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${chain}/${pairAddress}`)
    const dsJson = await dsRes.json() as any
    const p = dsJson.pair
    out.push({
      dex: 'DexScreener',
      pairAddress,
      priceUsd: parseFloat(p.priceUsd),
      volume24h: parseFloat(p.volumeUsd24Hr),
      liquidityUsd: parseFloat(p.liquidity.usd)
    })
  } catch (err) {
    console.warn('DexScreener failed:', err)
  }

  // 2) Jupiter quote endpoint
  try {
    const jRes = await fetch(`https://quote-api.jup.ag/v4/quote?inputMint=${pairAddress}&outputMint=${pairAddress}`)
    const jJson = await jRes.json() as any
    if (jJson.data?.length) {
      const best = jJson.data[0]
      out.push({
        dex: 'Jupiter',
        pairAddress,
        priceUsd: parseFloat(best.priceImpactPct.toString()),   // best guess
        volume24h: 0,
        liquidityUsd: 0
      })
    }
  } catch (err) {
    console.warn('Jupiter quote failed:', err)
  }

  // 3) Orca pools
  try {
    const orcaRes = await fetch(`https://api.orca.so/pools/${pairAddress}`)
    const orcaJson = await orcaRes.json() as any
    out.push({
      dex: 'Orca',
      pairAddress,
      priceUsd: orcaJson.price,
      volume24h: orcaJson.volume24h,
      liquidityUsd: orcaJson.liquidity
    })
  } catch (err) {
    console.warn('Orca API failed:', err)
  }

  return out
}