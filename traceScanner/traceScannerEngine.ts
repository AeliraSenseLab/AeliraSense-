// /tracescanner/traceScannerEngine.ts

import { Connection, PublicKey, ParsedConfirmedTransaction } from '@solana/web3.js'

/**
 * TraceScannerEngine
 *
 * Connects to Solana, fetches recent transactions for a program or account,
 * and returns parsed transaction data.
 */
export class TraceScannerEngine {
  private connection: Connection

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed')
  }

  /**
   * Fetch the latest `limit` transactions involving a given address or program.
   */
  public async fetchRecentTraces(
    address: string,
    limit: number = 20
  ): Promise<ParsedConfirmedTransaction[]> {
    const pubkey = new PublicKey(address)
    // get recent signatures
    const sigInfos = await this.connection.getSignaturesForAddress(pubkey, { limit })
    const signatures = sigInfos.map(info => info.signature)

    // fetch parsed transactions
    const txns = await Promise.all(
      signatures.map(sig =>
        this.connection.getParsedConfirmedTransaction(sig, 'confirmed')
      )
    )

    // filter out nulls
    return txns.filter((tx): tx is ParsedConfirmedTransaction => tx !== null)
  }
}
