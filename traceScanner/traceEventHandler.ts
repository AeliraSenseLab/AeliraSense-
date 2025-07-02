// /tracescanner/traceEventHandler.ts

import { ParsedConfirmedTransaction } from '@solana/web3.js'
import { TraceScannerEngine } from './traceScannerEngine'

export type TraceCallback = (tx: ParsedConfirmedTransaction) => void

/**
 * TraceEventHandler
 *
 * Uses TraceScannerEngine to poll for new transactions and
 * invokes your callback when matching criteria are met.
 */
export class TraceEventHandler {
  private engine: TraceScannerEngine
  private lastSeenSignature: string | null = null
  private pollingInterval: number

  constructor(rpcUrl: string, pollingIntervalMs: number = 30_000) {
    this.engine = new TraceScannerEngine(rpcUrl)
    this.pollingInterval = pollingIntervalMs
  }

  /**
   * Start watching an address/program and fire callback on each new transaction.
   */
  public start(
    address: string,
    callback: TraceCallback,
    fetchLimit: number = 20
  ): NodeJS.Timeout {
    const poll = async () => {
      try {
        const txns = await this.engine.fetchRecentTraces(address, fetchLimit)
        for (const tx of txns) {
          const sig = tx.transaction.signatures[0]
          if (this.lastSeenSignature === sig) break
          callback(tx)
        }
        // update lastSeenSignature to the most recent
        if (txns.length > 0) {
          this.lastSeenSignature = txns[0].transaction.signatures[0]
        }
      } catch (err) {
        console.error('TraceEventHandler error:', err)
      }
    }

    // initial poll immediately, then interval
    poll()
    return setInterval(poll, this.pollingInterval)
  }
}
