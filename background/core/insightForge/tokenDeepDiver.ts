// /tokeninsights/tokenDeepDiver.ts
import { Connection, PublicKey } from '@solana/web3.js'

export interface DeepMetrics {
  holderCount: number
  averageBalance: number
  varianceBalance: number
}

/**
 * Performs a deeper on-chain dive: fetches all holder accounts,
 * computes count, mean & variance of balances.
 */
export async function tokenDeepDiver(
  rpcUrl: string,
  mint: string
): Promise<DeepMetrics> {
  const conn = new Connection(rpcUrl, 'confirmed')

  const resp = await conn.getProgramAccounts(
    new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    {
      encoding: 'jsonParsed',
      filters: [
        { dataSize: 165 },
        { memcmp: { offset: 0, bytes: mint } }
      ]
    }
  )

  const balances = resp.map(acc =>
    Number((acc.account.data as any).parsed.info.tokenAmount.amount)
  )

  const holderCount = balances.length
  const mean = balances.reduce((s, v) => s + v, 0) / holderCount
  const variance = balances.reduce((s, v) => s + (v - mean) ** 2, 0) / holderCount

  return {
    holderCount,
    averageBalance: mean,
    varianceBalance: variance
  }
}
