import NodeCache from 'node-cache'
import fetch from 'node-fetch'

/**
 * Caches metrics fetched from AeliraSense agents or external APIs.
 */
export class AeliraMetricsCache {
  private cache = new NodeCache({ stdTTL: 60 }) // 60s default TTL

  constructor(private rpcUrl: string) {}

  /** Get SOL balance, cached */
  public async getSolBalance(address: string): Promise<number> {
    const key = `sol:${address}`
    const cached = this.cache.get<number>(key)
    if (cached !== undefined) return cached

    const { Connection, PublicKey } = await import('@solana/web3.js')
    const conn = new Connection(this.rpcUrl, 'confirmed')
    const lamports = await conn.getBalance(new PublicKey(address))
    const sol = lamports / 1e9
    this.cache.set(key, sol)
    return sol
  }

  /** Get token balance, cached */
  public async getTokenBalance(owner: string, mint: string): Promise<number> {
    const key = `tok:${owner}:${mint}`
    const cached = this.cache.get<number>(key)
    if (cached !== undefined) return cached

    const { Connection, PublicKey } = await import('@solana/web3.js')
    const conn = new Connection(this.rpcUrl, 'confirmed')
    const resp = await conn.getTokenAccountsByOwner(
      new PublicKey(owner),
      { mint: new PublicKey(mint) },
      { encoding: 'jsonParsed' }
    )
    let bal = 0
    if (resp.value[0]) {
      bal = Number((resp.value[0].account.data.parsed.info.tokenAmount as any).uiAmount)
    }
    this.cache.set(key, bal)
    return bal
  }
}
