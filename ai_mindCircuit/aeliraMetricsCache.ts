import NodeCache from 'node-cache'
import { Connection, PublicKey } from '@solana/web3.js'

/**
 * A simple in-memory cache for Solana-related metrics,
 * with configurable TTL and robust error handling.
 */
export class AeliraMetricsCache {
  private cache: NodeCache
  private connection: Connection

  /**
   * @param rpcUrl      RPC endpoint for Solana cluster
   * @param defaultTTL  Default time-to-live for cache entries, in seconds
   */
  constructor(private rpcUrl: string, defaultTTL = 60) {
    this.cache = new NodeCache({ stdTTL: defaultTTL, checkperiod: defaultTTL * 0.2 })
    this.connection = new Connection(this.rpcUrl, 'confirmed')
  }

  /**
   * Fetch and cache SOL balance for a given address
   * @param address   Base58-encoded public key
   * @param ttl       Optional override TTL for this call
   */
  public async getSolBalance(address: string, ttl?: number): Promise<number> {
    const key = `sol:${address}`
    const cached = this.cache.get<number>(key)
    if (cached !== undefined) {
      return cached
    }

    try {
      const lamports = await this.connection.getBalance(new PublicKey(address))
      const sol = lamports / 1e9
      this.cache.set(key, sol, ttl)
      return sol
    } catch (error) {
      console.error(`[AeliraMetricsCache] Error fetching SOL balance for ${address}`, error)
      return 0
    }
  }

  /**
   * Fetch and cache token balance (sum of all associated accounts)
   * @param owner     Owner public key (wallet)
   * @param mint      Mint address of the token
   * @param ttl       Optional override TTL for this call
   */
  public async getTokenBalance(
    owner: string,
    mint: string,
    ttl?: number
  ): Promise<number> {
    const key = `tok:${owner}:${mint}`
    const cached = this.cache.get<number>(key)
    if (cached !== undefined) {
      return cached
    }

    try {
      const resp = await this.connection.getTokenAccountsByOwner(
        new PublicKey(owner),
        { mint: new PublicKey(mint) },
        { encoding: 'jsonParsed' }
      )

      // Sum over all token accounts owned by this owner
      const total = resp.value.reduce((sum, acct) => {
        const amt = (acct.account.data.parsed.info.tokenAmount.uiAmount as number) || 0
        return sum + amt
      }, 0)

      this.cache.set(key, total, ttl)
      return total
    } catch (error) {
      console.error(
        `[AeliraMetricsCache] Error fetching token balance for ${owner} / ${mint}`,
        error
      )
      return 0
    }
  }

  /**
   * Force-clear a specific cache entry
   * @param keyPattern  Pattern or exact key to delete
   */
  public clearKey(keyPattern: string): void {
    this.cache.del(this.cache.keys().filter(k => k.includes(keyPattern)))
  }

  /**
   * Clear all cached entries
   */
  public clearAll(): void {
    this.cache.flushAll()
  }
}

// Usage example:
// const metrics = new AeliraMetricsCache('https://api.mainnet-beta.solana.com', 120)
// const sol = await metrics.getSolBalance('YourPublicKeyHere')
// const usdc = await metrics.getTokenBalance('YourPublicKeyHere', 'TokenMintAddressHere', 30)
