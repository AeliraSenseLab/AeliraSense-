
import fetch from 'node-fetch'
import { Connection, PublicKey } from '@solana/web3.js'

export interface EmergingToken {
  mint: string
  creator: string
  supply: number
  timestamp: number
}

/**
 * Scans for newly initialized mints (emerging tokens) on Solana.
 */
export class EmergingTokenScanner {
  private connection: Connection
  private lastSlot: number

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed')
    this.lastSlot = 0
  }

  /**
   * Fetch recent InitializeMint instructions since the last slot.
   */
  public async scanEmergingTokens(): Promise<EmergingToken[]> {
    const currentSlot = await this.connection.getSlot('confirmed')
    const from = this.lastSlot + 1
    this.lastSlot = currentSlot

    // Get signatures for the SPL Token program
    const tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    const sigInfos = await this.connection.getSignaturesForAddress(tokenProgram, { limit: 500 })
    const events: EmergingToken[] = []

    for (const info of sigInfos) {
      if (info.slot < from) continue
      const tx = await this.connection.getParsedConfirmedTransaction(info.signature, 'confirmed')
      if (!tx?.meta?.logMessages) continue

      if (tx.meta.logMessages.some(l => l.includes('Instruction: InitializeMint'))) {
        // find the mint account in the message
        const inst = tx.transaction.message.instructions.find((ix: any) =>
          ix.program === 'spl-token' && ix.parsed?.type === 'initializeMint'
        ) as any
        if (!inst) continue

        const mint = inst.parsed.info.mint as string
        const creator = tx.transaction.message.accountKeys[0].toBase58()
        // fetch total supply (initial supply likely zero)
        const supplyInfo = await this.connection.getTokenSupply(new PublicKey(mint))
        const supply = Number(supplyInfo.value.amount)

        events.push({ mint, creator, supply, timestamp: tx.blockTime || Date.now() })
      }
    }

    return events
  }
}
