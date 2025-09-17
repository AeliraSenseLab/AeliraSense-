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

export class EmergingTokenScanner {
  private connection: Connection
  private tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
  private lastSlot = 0
  private lastSignature: string | null = null
  private limit: ReturnType<typeof pLimit>
  private commitment: Commitment
  private pageLimit: number
  private maxTxPerScan: number

  constructor(rpcUrl: string, options: ScannerOptions = {}) {
    this.commitment = options.commitment ?? 'confirmed'
    this.connection = new Connection(rpcUrl, this.commitment)
    this.limit = pLimit(Math.max(1, options.concurrency ?? 6))
    this.pageLimit = Math.min(Math.max(options.pageLimit ?? 500, 50), 1000)
    this.maxTxPerScan = Math.min(Math.max(options.maxTransactionsPerScan ?? 1500, 100), 5000)
  }

  async scan(): Promise<EmergingToken[]> {
    const currentSlot = await this.connection.getSlot(this.commitment)
    const fromSlot = this.lastSlot > 0 ? this.lastSlot + 1 : 0
    const result: EmergingToken[] = []

    let totalFetched = 0
    let before: string | undefined = undefined
    let done = false

    while (!done) {
      const sigs = await this.connection.getSignaturesForAddress(
        this.tokenProgram,
        { before, limit: this.pageLimit, until: this.lastSignature ?? undefined },
        this.commitment
      )

      if (!sigs.length) break

      const earliestSlot = Math.min(...sigs.map(s => s.slot))
      if (fromSlot > 0 && earliestSlot < fromSlot) {
        const filtered = sigs.filter(s => s.slot >= fromSlot)
        await this.process(filtered, result)
        break
      }

      await this.process(sigs, result)

      totalFetched += sigs.length
      before = sigs.at(-1)?.signature

      if (
        totalFetched >= this.maxTxPerScan ||
        (this.lastSignature && sigs.some(s => s.signature === this.lastSignature))
      ) done = true
    }

    this.lastSlot = currentSlot
    if (result.length > 0) {
      const latest = result.reduce((a, b) => (b.slot > a.slot ? b : a))
      this.lastSignature = latest.signature
    }

    return result.sort((a, b) => a.slot - b.slot)
  }

  private async process(signatures: { signature: string; slot: number }[], out: EmergingToken[]) {
    await Promise.all(
      signatures.map(sigInfo =>
        this.limit(async () => {
          const tx = await this.connection.getParsedTransaction(sigInfo.signature, {
            commitment: this.commitment,
            maxSupportedTransactionVersion: 0,
          })

          const instructions = tx?.transaction?.message?.instructions as ParsedInstruction[] | undefined
          if (!instructions) return

          for (const ix of instructions) {
            if (!('programId' in ix) || !('parsed' in ix)) continue
            if (!ix.programId.equals(this.tokenProgram)) continue

            const parsed = ix.parsed as any
            if (!parsed?.type) continue

            if (parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') {
              const info = parsed.info ?? {}
              const mint = info.mint
              const authority = info.mintAuthority ?? info.authority

              if (!mint || !authority) continue

              const supplyRaw = await this.connection.getTokenSupply(new PublicKey(mint), this.commitment)
              const supply = Number(supplyRaw.value.amount)
              const timestamp = (typeof tx.blockTime === 'number' ? tx.blockTime : Math.floor(Date.now() / 1000)) * 1000

              out.push({
                mint,
                creator: authority,
                supply,
                timestamp,
                slot: info.slot ?? tx.slot,
                signature: info.signature ?? tx.transaction.signatures?.[0] ?? '',
              })
            }
          }
        })
      )
    )
  }

  reset(): void {
    this.lastSlot = 0
    this.lastSignature = null
  }
}
