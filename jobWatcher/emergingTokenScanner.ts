import pLimit from 'p-limit'
import { Connection, PublicKey, ParsedInstruction, Commitment } from '@solana/web3.js'

export interface EmergingToken {
  mint: string
  creator: string
  supply: number
  timestamp: number
  slot: number
  signature: string
}

export interface ScannerOptions {
  commitment?: Commitment
  concurrency?: number
  pageLimit?: number
  maxTransactionsPerScan?: number
}

/**
 * Scans for newly initialized SPL token mints by reading parsed transactions on the SPL Token program
 * State is kept across calls to support incremental scans without duplication
 */
export class EmergingTokenScanner {
  private connection: Connection
  private tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
  private lastScannedSlot = 0
  private lastSeenSignature: string | null = null
  private limit: ReturnType<typeof pLimit>
  private commitment: Commitment
  private pageLimit: number
  private maxTransactionsPerScan: number

  constructor(rpcUrl: string, opts: ScannerOptions = {}) {
    this.connection = new Connection(rpcUrl, opts.commitment ?? 'confirmed')
    this.commitment = opts.commitment ?? 'confirmed'
    this.limit = pLimit(Math.max(1, opts.concurrency ?? 6))
    this.pageLimit = Math.max(50, Math.min(1000, opts.pageLimit ?? 500))
    this.maxTransactionsPerScan = Math.max(100, Math.min(5000, opts.maxTransactionsPerScan ?? 1500))
  }

  /**
   * Perform an incremental scan since the previous call
   * Returns a list of tokens whose mints were initialized in the new range
   */
  async scanEmergingTokens(): Promise<EmergingToken[]> {
    const nowSlot = await this.connection.getSlot(this.commitment)
    const fromSlot = this.lastScannedSlot > 0 ? this.lastScannedSlot + 1 : 0
    const events: EmergingToken[] = []

    let fetched = 0
    let before: string | undefined = undefined
    let done = false

    while (!done) {
      const sigInfos = await this.connection.getSignaturesForAddress(
        this.tokenProgram,
        {
          before,
          limit: this.pageLimit,
          until: this.lastSeenSignature ?? undefined,
        },
        this.commitment
      )

      if (sigInfos.length === 0) break

      const minSlotInPage = Math.min(...sigInfos.map(s => s.slot))
      if (fromSlot > 0 && minSlotInPage < fromSlot) {
        const trimmed = sigInfos.filter(s => s.slot >= fromSlot)
        await this.processSignatures(trimmed, events)
        break
      }

      await this.processSignatures(sigInfos, events)

      fetched += sigInfos.length
      before = sigInfos[sigInfos.length - 1]?.signature
      if (fetched >= this.maxTransactionsPerScan) done = true
      if (this.lastSeenSignature && sigInfos.some(s => s.signature === this.lastSeenSignature)) done = true
    }

    this.lastScannedSlot = nowSlot
    if (events.length > 0) {
      const top = events.reduce((a, b) => (b.slot > a.slot ? b : a))
      this.lastSeenSignature = top.signature
    }

    return events.sort((a, b) => a.slot - b.slot)
  }

  private async processSignatures(sigInfos: Array<{ signature: string } & { slot: number }>, out: EmergingToken[]) {
    await Promise.all(
      sigInfos.map(info =>
        this.limit(async () => {
          const tx = await this.connection.getParsedTransaction(info.signature, { commitment: this.commitment, maxSupportedTransactionVersion: 0 })
          if (!tx?.transaction?.message?.instructions) return

          for (const rawIx of tx.transaction.message.instructions as ParsedInstruction[]) {
            if (!('programId' in rawIx) || !('parsed' in rawIx)) continue
            if (!rawIx.programId.equals(this.tokenProgram)) continue
            const parsed = (rawIx as ParsedInstruction).parsed as any
            if (!parsed?.type) continue

            if (parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') {
              const info = parsed.info ?? {}
              const mintAddr: string | undefined = info.mint
              const creatorAuthority: string | undefined = info.mintAuthority ?? info.authority

              if (!mintAddr || !creatorAuthority) continue

              const supplyRaw = await this.connection.getTokenSupply(new PublicKey(mintAddr), this.commitment)
              const supply = Number(supplyRaw.value.amount)

              const timestampSec = typeof tx.blockTime === 'number' ? tx.blockTime : Math.floor(Date.now() / 1000)
              out.push({
                mint: mintAddr,
                creator: creatorAuthority,
                supply,
                timestamp: timestampSec * 1000,
                slot: info.slot ?? tx.slot,
                signature: info.signature ?? (tx.transaction.signatures?.[0] ?? ''),
              })
            }
          }
        })
      )
    )
  }

  /**
   * Reset the incremental state, forcing the next scan to treat everything as new
   */
  resetProgress(): void {
    this.lastScannedSlot = 0
    this.lastSeenSignature = null
  }
}
