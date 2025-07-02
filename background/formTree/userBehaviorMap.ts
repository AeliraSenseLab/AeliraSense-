
export interface BehaviorProfile {
  lastActive: number        // timestamp ms
  txCount: number           // total transactions
  avgTxValue: number        // average lamports per tx
}


export class UserBehaviorMap {
  private map: Map<string, BehaviorProfile> = new Map()

  /**
   * Retrieve or initialize a profile for a given address.
   */
  public get(address: string): BehaviorProfile {
    if (!this.map.has(address)) {
      this.map.set(address, { lastActive: 0, txCount: 0, avgTxValue: 0 })
    }
    return this.map.get(address)!
  }

  /**
   * Update a user's profile with a new transaction event.
   */
  public recordTx(
    address: string,
    timestampMs: number,
    txValueLamports: number
  ): BehaviorProfile {
    const profile = this.get(address)
    // update last active
    profile.lastActive = Math.max(profile.lastActive, timestampMs)
    // update average tx value
    profile.txCount += 1
    profile.avgTxValue =
      ((profile.avgTxValue * (profile.txCount - 1)) + txValueLamports) /
      profile.txCount
    this.map.set(address, profile)
    return profile
  }

  /**
   * Remove stale profiles not active since cutoff.
   */
  public pruneStale(cutoffMs: number): void {
    for (const [addr, profile] of this.map.entries()) {
      if (profile.lastActive < cutoffMs) {
        this.map.delete(addr)
      }
    }
  }
}
