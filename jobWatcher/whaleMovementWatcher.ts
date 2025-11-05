import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js'

export interface WhaleMovement {
  signature: string
  mint: string
  amount: number
  sender: string
  recipient: string
  timestamp: number
}

export interface WhaleMovementWatcherOptions {
  rpcUrl: string
  threshold: number       // in base units
  tokenProgram?: PublicKey
  commitment?: 'processed' | 'confirmed' | 'finalized'
  concurrency?: number    // max parallel RPC calls
}


export class WhaleMovementWatcher {
  private connection: Connection
  private threshold: number
  private tokenProgram: PublicKey
  private lastSignature: string | null = null
  private commitment: 'processed' | 'confirmed' | 'finalized'
  private concurrency: number

  constructor(opts: WhaleMovementWatcherOptions) {
    this.connection = new Connection(
      opts.rpcUrl,
      opts.commitment ?? 'confirmed'
    )
    this.threshold = opts.threshold
    this.tokenProgram =
      opts.tokenProgram ??
      new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    this.commitment = opts.commitment ?? 'confirmed'
    // limit parallel getParsedTransaction calls
    this.concurrency = opts.concurrency ?? 5
  }

 

  private async fetchParsedTx(sig: string): Promise<ParsedTransactionWithMeta | null> {
    try {
      return await this.connection.getParsedTransaction(sig, this.commitment)
    } catch (err) {
      console.warn(`Failed to fetch tx ${sig}:`, err)
      return null
    }
  }

  /**
   * Process parsed transaction instructions to extract whale moves.
   */
  private extractWhaleMoves(
    sig: string,
    tx: ParsedTransactionWithMeta
  ): WhaleMovement[] {
    const moves: WhaleMovement[] = []
    const blockTime = tx.blockTime ?? Date.now()
    for (const instr of tx.transaction.message.instructions as any[]) {
      if (
        instr.program === 'spl-token' &&
        instr.parsed?.type === 'transfer'
      ) {
        const info = instr.parsed.info
        const amount = Number(info.amount)
        if (amount >= this.threshold) {
          moves.push({
            signature: sig,
            mint: info.mint,
            amount,
            sender: info.source,
            recipient: info.destination,
            timestamp: blockTime,
          })
        }
      }
    }
    return moves
  }

  /**
   * Poll the SPL Token program for recent transfers exceeding threshold.
   * Returns at most `limit` new whale movements since last invocation.
   */
  public async traceWhaleMovements(
    limit: number = 100
  ): Promise<WhaleMovement[]> {
    // 1. Fetch recent signatures
    const sigInfos = await this.connection.getSignaturesForAddress(
      this.tokenProgram,
      { limit }
    )

    // 2. Stop if no new signatures
    if (sigInfos.length === 0) {
      return []
    }

    // 3. Collect signatures up to lastSignature (exclusive)
    const newSigs: string[] = []
    for (const info of sigInfos) {
      if (this.lastSignature === info.signature) break
      newSigs.push(info.signature)
    }

    // 4. Update lastSignature
    this.lastSignature = sigInfos[0].signature

    // 5. Fetch parsed transactions with limited concurrency
    const results: WhaleMovement[] = []
    const queue = [...newSigs]
    const workers: Promise<void>[] = []

    const worker = async () => {
      while (queue.length > 0) {
        const sig = queue.shift()!
        const tx = await this.fetchParsedTx(sig)
        if (tx && tx.meta && tx.meta.logMessages) {
          const moves = this.extractWhaleMoves(sig, tx)
          if (moves.length) {
            results.push(...moves)
          }
        }
      }
    }

    for (let i = 0; i < this.concurrency; i++) {
      workers.push(worker())
    }
    await Promise.all(workers)

    return results
  }
}
