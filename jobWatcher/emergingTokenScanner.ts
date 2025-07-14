import fetch from 'node-fetch'
import pLimit from 'p-limit'
import { Connection, PublicKey, ParsedInstruction } from '@solana/web3.js'

export interface EmergingToken {
  mint: string
  creator: string
  supply: number
  timestamp: number
}

export class EmergingTokenScanner {
  private connection: Connection
  private lastScannedSlot = 0
  private tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
  private limit = pLimit(5)

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed')
  }

  async scanEmergingTokens(): Promise<EmergingToken[]> {
    const currentSlot = await this.connection.getSlot('confirmed')
    const fromSlot = this.lastScannedSlot + 1
    this.lastScannedSlot = currentSlot

    const sigInfos = await this.connection.getSignaturesForAddress(
      this.tokenProgram,
      { limit: 500 }
    )

    const newTxs = sigInfos.filter(s => s.slot >= fromSlot)
    const events: EmergingToken[] = []

    await Promise.all(
      newTxs.map(info =>
        this.limit(async () => {
          const tx = await this.connection.getParsedTransaction(info.signature, 'confirmed')
          if (!tx || !tx.transaction.message.instructions) return
          for (const ix of tx.transaction.message.instructions as ParsedInstruction[]) {
            if (
              ix.programId.equals(this.tokenProgram) &&
              ix.parsed?.type === 'initializeMint'
            ) {
              const { mint, authority } = (ix.parsed.info as any)
              const supplyRaw = await this.connection.getTokenSupply(new PublicKey(mint))
              const supply = Number(supplyRaw.value.amount)
              events.push({
                mint,
                creator: authority,
                supply,
                timestamp: (tx.blockTime ?? Date.now() / 1000) * 1000
              })
            }
          }
        })
      )
    )

    return events
  }
}
