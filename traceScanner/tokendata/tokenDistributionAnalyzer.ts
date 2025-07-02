// /tokendata/tokenDistributionAnalyzer.ts

import fetch from 'node-fetch'

export interface HolderInfo {
  address: string
  amount: number
}

export interface DistributionStats {
  totalSupply: number
  topHolders: HolderInfo[]
  giniCoefficient: number
}

/**
 * Fetch top N holders and calculate basic distribution stats.
 */
export async function analyzeTokenDistribution(
  tokenMint: string,
  topN: number = 20
): Promise<DistributionStats> {
  // use Solscan public API for holder data
  const url = `https://public-api.solscan.io/token/holders?tokenAddress=${tokenMint}&limit=1000`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch holders: ${res.statusText}`)
  const data = (await res.json()) as any[]

  const holders: HolderInfo[] = data.map(h => ({
    address: h.ownerAddress,
    amount: Number(h.tokenAmount)
  }))
  const totalSupply = holders.reduce((sum, h) => sum + h.amount, 0)

  // sort descending, take top N
  const topHolders = holders
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topN)

  // compute Gini coefficient
  const sorted = holders.map(h => h.amount).sort((a, b) => a - b)
  const n = sorted.length
  const cumulative = sorted.reduce((sum, v, i) => sum + v * (i + 1), 0)
  const gini = (2 * cumulative) / (n * totalSupply) - (n + 1) / n

  return {
    totalSupply,
    topHolders,
    giniCoefficient: parseFloat(gini.toFixed(4))
  }
}
