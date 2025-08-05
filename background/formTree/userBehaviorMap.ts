export interface BehaviorProfile {
  /** Last activity timestamp (ms since epoch) */
  lastActive: number
  /** Total number of transactions recorded */
  txCount: number
  /** Average lamports per transaction */
  avgTxValue: number
}

export class UserBehaviorMap {
  private map = new Map<string, BehaviorProfile>()

  /**
   * Get the profile for an address, initializing if necessary
   * @param address  Base58-encoded public key
   */
  public get(address: string): BehaviorProfile {
    let profile = this.map.get(address)
    if (!profile) {
      profile = { lastActive: 0, txCount: 0, avgTxValue: 0 }
      this.map.set(address, profile)
    }
    return profile
  }

  /**
   * Record a transaction: updates lastActive, txCount, and avgTxValue
   * @param address         Address of the user
   * @param timestampMs     Transaction timestamp in ms
   * @param txValueLamports Transaction value in lamports
   */
  public recordTx(
    address: string,
    timestampMs: number,
    txValueLamports: number
  ): BehaviorProfile {
    const p = this.get(address)
    // update last active
    p.lastActive = Math.max(p.lastActive, timestampMs)
    // update counts and average
    p.txCount += 1
    p.avgTxValue = (p.avgTxValue * (p.txCount - 1) + txValueLamports) / p.txCount
    return p
  }

  /**
   * Remove profiles that have been inactive since before cutoff
   * @param cutoffMs  Profiles with lastActive < cutoffMs will be removed
   */
  public pruneStale(cutoffMs: number): void {
    for (const [addr, profile] of this.map) {
      if (profile.lastActive < cutoffMs) {
        this.map.delete(addr)
      }
    }
  }

  /** Get number of tracked profiles */
  public get size(): number {
    return this.map.size
  }

  /** Clear all profiles */
  public clearAll(): void {
    this.map.clear()
  }

  /**
   * List all active profiles as [address, profile] tuples
   */
  public entries(): [string, BehaviorProfile][] {
    return Array.from(this.map.entries())
  }
}
