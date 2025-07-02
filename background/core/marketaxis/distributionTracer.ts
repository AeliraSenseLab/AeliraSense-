
import fetch from 'node-fetch'

export interface HolderInfo {
  address: string
  amount: number  // base units
}

/**
 * Retrieves top-N holders of a mint via Solscan and returns a snapshot.
 */
export async function traceTokenDistribution(
  mint: string,
  topN: number = 20
): Promise<HolderInfo[]> {
  const url = `https://public-api.solscan.io/token/holders?tokenAddress=${mint}&limit=${topN}`
  const res = await fetch(url)
  const data = (await res.json()) as any[]
  return data.map(h => ({
    address: h.ownerAddress,
    amount: Number(h.tokenAmount)
  }))
}
