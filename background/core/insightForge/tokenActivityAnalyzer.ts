// /tokeninsights/tokenActivityAnalyzer.ts
import fetch from 'node-fetch'

export interface ActivityStats {
  totalTransfers: number
  totalVolume: number   // in base units
  uniqueSenders: number
  uniqueReceivers: number
}

/**
 * Summarizes basic transfer activity for a mint over the last N txns.
 */
export async function tokenActivityAnalyzer(
  mint: string,
  limit: number = 200
): Promise<ActivityStats> {
  const url = `https://public-api.solscan.io/account/token/txs?account=${mint}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Activity fetch failed: ${res.status}`)
  const data = (await res.json()).data as any[]

  const transfers = data.filter(tx => tx.err === null)
  const totalTransfers = transfers.length
  const totalVolume = transfers.reduce((sum, tx) => sum + Number(tx.tokenAmount.amount), 0)

  const senders = new Set<string>()
  const receivers = new Set<string>()
  transfers.forEach(tx => {
    senders.add(tx.userAddress)
    receivers.add(tx.destination)
  })

  return {
    totalTransfers,
    totalVolume,
    uniqueSenders: senders.size,
    uniqueReceivers: receivers.size
  }
}
