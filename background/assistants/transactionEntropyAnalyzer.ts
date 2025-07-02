import fetch from 'node-fetch'

export interface EntropyResult {
  mint: string
  entropy: number    // Shannon entropy of recipient distribution
  timestamp: number
}

/**
 * Computes Shannon entropy over recipients in recent transfers.
 */
export async function transactionEntropyAnalyzer(
  mint: string,
  limit: number = 200
): Promise<EntropyResult> {
  const res = await fetch(
    `https://public-api.solscan.io/account/token/txs?account=${mint}&limit=${limit}`
  )
  const data = (await res.json()).data as any[]
  const transfers = data.filter(tx => tx.err === null)

  const freq = transfers.reduce((acc: Record<string, number>, tx) => {
    const to = tx.destination
    acc[to] = (acc[to] || 0) + 1
    return acc
  }, {})

  const total = transfers.length || 1
  const entropy = Object.values(freq).reduce((H, count) => {
    const p = count / total
    return H - (p > 0 ? p * Math.log2(p) : 0)
  }, 0)

  return {
    mint,
    entropy: parseFloat(entropy.toFixed(3)),
    timestamp: Date.now()
  }
}
