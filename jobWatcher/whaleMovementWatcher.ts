
import { Connection, PublicKey, ParsedConfirmedTransaction } from '@solana/web3.js'

export interface WhaleMovement {
  signature: string
  mint: string
  amount: number
  sender: string
  recipient: string
  timestamp: number
}

/**
 * Watches for large SPL token transfers (“whale moves”) on Solana.
 */
export class WhaleMovementWatcher {
  private connection: Connection
  private threshold: number      // in base units
  private lastSignature: string | null

  constructor(rpcUrl: string, threshold: number) {
    this.connection = new Connection(rpcUrl, 'confirmed')
    this.threshold = threshold
    this.lastSignature = null
  }

  /**
   * Poll the SPL Token program for recent transfers exceeding threshold.
   */
  public async traceWhaleMovements(limit: number = 100): Promise<WhaleMovement[]> {
    const tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    const sigInfos = await this.connection.getSignaturesForAddress(tokenProgram, { limit })
    const results: WhaleMovement[] = []

    for (const info of sigInfos) {
      if (this.lastSignature && info.signature === this.lastSignature) break

      const tx = await this.connection.getParsedConfirmedTransaction(info.signature, 'confirmed')
      if (!tx?.meta?.logMessages) continue

      for (const ix of tx.transaction.message.instructions as any[]) {
        if (ix.program === 'spl-token' && ix.parsed?.type === 'transfer') {
          const amt = Number(ix.parsed.info.amount)
          if (amt >= this.threshold) {
            results.push({
              signature: info.signature,
              mint: ix.parsed.info.mint,
              amount: amt,
              sender: ix.parsed.info.source,
              recipient: ix.parsed.info.destination,
              timestamp: tx.blockTime || Date.now()
            })
          }
        }
      }
    }

    if (sigInfos.length) {
      this.lastSignature = sigInfos[0].signature
    }
    return results
  }
}
