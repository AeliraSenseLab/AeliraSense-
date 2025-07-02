import { Wallet } from "@solana/solana-sdk"
import type { RequestAirdropResult } from "./types"

/**
 * Manages requesting test SOL and tokens from a faucet,
 * with retry logic, rate-limit handling, and unified interface.
 */
export class TestFundsManager {
  private wallet: Wallet
  private maxRetries: number
  private retryDelayMs: number

  constructor(wallet: Wallet, options?: { maxRetries?: number; retryDelayMs?: number }) {
    this.wallet = wallet
    this.maxRetries = options?.maxRetries ?? 3
    this.retryDelayMs = options?.retryDelayMs ?? 2000
  }

  /**
   * Request test SOL from the faucet, retrying on failure.
   */
  public async requestSol(amountLamports: number): Promise<RequestAirdropResult> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const tx = await this.wallet.requestAirdrop(amountLamports)
        const confirmation = await tx.wait()
        return {
          success: true,
          message: `Received ${amountLamports} lamports on attempt ${attempt}`,
          txSignature: confirmation.signature
        }
      } catch (err: any) {
        if (attempt === this.maxRetries) {
          return { success: false, message: `SOL airdrop failed: ${err.message}` }
        }
        await this.delay(this.retryDelayMs)
      }
    }
    // unreachable
    return { success: false, message: "Unknown error during SOL request" }
  }

  /**
   * Request test tokens by mint address, falling back to SOL if unavailable.
   */
  public async requestToken(mintAddress: string, amount: number): Promise<RequestAirdropResult> {
    try {
      const tx = await this.wallet.faucet({ tokenMint: mintAddress, amount })
      const confirmation = await tx.wait()
      return {
        success: true,
        message: `Received ${amount} tokens of ${mintAddress}`,
        txSignature: confirmation.signature
      }
    } catch {
      // fallback to SOL if token faucet fails
      return this.requestSol(amount)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
