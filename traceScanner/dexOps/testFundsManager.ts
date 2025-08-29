import { Wallet } from "@solana/solana-sdk"
import type { RequestAirdropResult } from "./types"

export interface TestFundsOptions {
  maxRetries?: number
  retryDelayMs?: number
  airdropTimeoutMs?: number
  commitment?: "processed" | "confirmed" | "finalized"
  /** Amount of SOL (in lamports) to request if token faucet is unavailable */
  fallbackSolLamports?: number
}

/**
 * Manages requesting test SOL and tokens from a faucet with deterministic backoff,
 * basic rate-limit handling, and consistent confirmations.
 */
export class TestFundsManager {
  private wallet: Wallet
  private maxRetries: number
  private retryDelayMs: number
  private airdropTimeoutMs: number
  private commitment: "processed" | "confirmed" | "finalized"
  private fallbackSolLamports: number

  constructor(wallet: Wallet, options: TestFundsOptions = {}) {
    this.wallet = wallet
    this.maxRetries = options.maxRetries ?? 3
    this.retryDelayMs = options.retryDelayMs ?? 2000
    this.airdropTimeoutMs = options.airdropTimeoutMs ?? 30000
    this.commitment = options.commitment ?? "confirmed"
    this.fallbackSolLamports = Math.max(0, options.fallbackSolLamports ?? 1_000_000) // default 0.001 SOL
  }

  /**
   * Request test SOL from the faucet with retries and timeout.
   */
  public async requestSol(amountLamports: number): Promise<RequestAirdropResult> {
    if (!Number.isFinite(amountLamports) || amountLamports <= 0) {
      return { success: false, message: "Amount must be a positive number of lamports" }
    }

    const op = async () => {
      const tx = await this.wallet.requestAirdrop(amountLamports, { commitment: this.commitment } as any)
      const confirmation = await this.waitWithTimeout(tx.wait(), this.airdropTimeoutMs, "Airdrop confirmation timed out")
      return confirmation?.signature as string
    }

    return this.withRetry("SOL airdrop", `${amountLamports} lamports`, op)
  }

  /**
   * Request test tokens by mint address. If the token faucet is unavailable,
   * optionally falls back to requesting a small amount of SOL.
   */
  public async requestToken(mintAddress: string, amount: number): Promise<RequestAirdropResult> {
    if (!mintAddress) {
      return { success: false, message: "Mint address is required" }
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: "Amount must be a positive number" }
    }

    try {
      const tx = await (this.wallet as any).faucet({ tokenMint: mintAddress, amount, commitment: this.commitment })
      const confirmation = await this.waitWithTimeout(tx.wait(), this.airdropTimeoutMs, "Token faucet confirmation timed out")
      return {
        success: true,
        message: `Received ${amount} tokens of ${mintAddress}`,
        txSignature: confirmation?.signature
      }
    } catch (err: any) {
      if (this.fallbackSolLamports > 0) {
        return this.requestSol(this.fallbackSolLamports)
      }
      return { success: false, message: `Token faucet failed: ${this.errorMessage(err)}` }
    }
  }

  /**
   * Internal retry helper with deterministic quadratic backoff.
   * Backoff increases if a 429/rate-limit is detected.
   */
  private async withRetry(
    label: string,
    amountLabel: string,
    fn: () => Promise<string>
  ): Promise<RequestAirdropResult> {
    let lastErr: any = null

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const sig = await fn()
        return {
          success: true,
          message: `${label} success for ${amountLabel} on attempt ${attempt}`,
          txSignature: sig
        }
      } catch (err: any) {
        lastErr = err
        if (attempt === this.maxRetries) break

        const rateLimited = this.isRateLimit(err)
        const delayMs = this.computeBackoff(attempt, rateLimited)
        await this.delay(delayMs)
      }
    }

    return {
      success: false,
      message: `${label} failed after ${this.maxRetries} attempts: ${this.errorMessage(lastErr)}`
    }
  }

  private computeBackoff(attempt: number, rateLimited: boolean): number {
    // Deterministic quadratic backoff, optionally doubled on rate limit
    const base = this.retryDelayMs * attempt * attempt
    return rateLimited ? base * 2 : base
  }

  private isRateLimit(err: any): boolean {
    const code = (err && (err.code ?? err.status)) as number | undefined
    const msg = (err && String(err.message || err.toString()).toLowerCase()) || ""
    return code === 429 || msg.includes("rate limit") || msg.includes("too many requests")
  }

  private errorMessage(err: any): string {
    if (!err) return "unknown error"
    if (typeof err === "string") return err
    if (err.message) return err.message
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }

  private async waitWithTimeout<T>(p: Promise<T>, timeoutMs: number, timeoutMsg: string): Promise<T> {
    let timeoutHandle: any
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(timeoutMsg)), timeoutMs)
    })
    try {
      const result = await Promise.race([p, timeoutPromise])
      return result as T
    } finally {
      clearTimeout(timeoutHandle)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
