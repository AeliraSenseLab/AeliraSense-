

import { Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'

/**
 * SigningEngine: builds a minimal on-chain record of analysis results.
 */
export class SigningEngine {
  constructor(private readonly programId: PublicKey, private readonly signer: Keypair) {}

  /**
   * Creates and signs a Solana transaction embedding the analysis as a memo.
   */
  public async signAnalysis(result: { mint: string; score: number; timestamp: number }): Promise<string> {
    const memo = Buffer.from(
      JSON.stringify({ mint: result.mint, score: result.score, ts: result.timestamp })
    )

    const ix = new TransactionInstruction({
      keys: [],
      programId: this.programId,
      data: memo
    })

    const tx = new Transaction().add(ix)
    tx.feePayer = this.signer.publicKey
    tx.recentBlockhash = (await tx.getRecentBlockhash()).blockhash

    tx.sign(this.signer)
    // In a real setup, you’d send via connection.sendRawTransaction
    return tx.serialize().toString('base64')
  }
}
