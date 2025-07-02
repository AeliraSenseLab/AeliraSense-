
import fetch from 'node-fetch'

export interface TransferEvent {
  signature: string
  slot: number
  amount: number    // base units
  source: string
  destination: string
}

export async function fetchRecentTransfers(
  mint: string,
  limit: number = 100
): Promise<TransferEvent[]> {
  const url = `https://public-api.solscan.io/account/token/txs?account=${mint}&limit=${limit}`
  const res = await fetch(url)
  const data = (await res.json()) as any
  return data.data
    .filter((tx: any) => tx.err === null)
    .map((tx: any) => ({
      signature: tx.signature,
      slot: tx.slot,
      amount: Number(tx.tokenAmount.amount),
      source: tx.userAddress,
      destination: tx.destination
    }))
}
