
import fetch from 'node-fetch'

export interface WhaleEvent {
  signature: string
  amount: number      // base units
  source: string
  destination: string
  timestamp: number
}

export async function detectWhaleMoves(
  mint: string,
  threshold: number = 100_000,
  limit: number = 200
): Promise<WhaleEvent[]> {
  const res = await fetch(
    `https://public-api.solscan.io/account/token/txs?account=${mint}&limit=${limit}`
  )
  const data = (await res.json()).data as any[]
  return data
    .filter(tx => tx.err === null && Number(tx.tokenAmount.amount) >= threshold)
    .map(tx => ({
      signature:   tx.signature,
      amount:      Number(tx.tokenAmount.amount),
      source:      tx.userAddress,
      destination: tx.destination,
      timestamp:   (tx.blockTime || 0) * 1000
    }))
}
