import { ParsedConfirmedTransaction } from '@solana/web3.js'
import { TraceScannerEngine } from './traceScannerEngine'

export type TraceCallback = (tx: ParsedConfirmedTransaction) => void

interface Watcher {
  lastSig: string | null
  intervalId: NodeJS.Timeout
}

/**
 * Continuously polls for new transactions and invokes callbacks.
 */
export class TraceEventHandler {
  private engine = new TraceScannerEngine(this.rpcUrl)
  private watchers = new Map<string, Watcher>()

  constructor(private rpcUrl: string, private pollingIntervalMs = 30_000) {}

  start(
    address: string,
    callback: TraceCallback,
    fetchLimit = 20
  ): void {
    if (this.watchers.has(address)) return

    let lastSig: string | null = null
    const poll = async () => {
      try {
        const txns = await this.engine.fetchRecentTraces(address, fetchLimit)
        for (const { transaction } of txns) {
          const sig = transaction.signatures[0]
          if (sig === lastSig) break
          callback({ transaction } as ParsedConfirmedTransaction)
        }
        if (txns.length) lastSig = txns[0].transaction.signatures[0]
      } catch (err) {
        console.error('TraceEventHandler error', err)
      }
    }

    poll()
    const intervalId = setInterval(poll, this.pollingIntervalMs)
    this.watchers.set(address, { lastSig, intervalId })
  }

  stop(address: string): void {
    const watcher = this.watchers.get(address)
    if (!watcher) return
    clearInterval(watcher.intervalId)
    this.watchers.delete(address)
  }

  stopAll(): void {
    for (const { intervalId } of this.watchers.values()) {
      clearInterval(intervalId)
    }
    this.watchers.clear()
  }
}
