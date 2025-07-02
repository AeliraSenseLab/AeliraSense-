// solFaucet.ts

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js"

export interface RequestFaucetFundsArgs {
  /** Omit or set to undefined to request SOL */
  assetMint?: string
  /** Amount in SOL (for SOL airdrop) or base units (for SPL) */
  amount: number
  /** Cluster to target (“devnet”, “testnet”, or “mainnet-beta”) */
  cluster?: "devnet" | "testnet" | "mainnet-beta"
}

export interface RequestFaucetFundsResult {
  message: string
  body?: {
    transactionSignature: string
    explorerLink: string
  }
}

/**
 * Requests test funds on Solana.
 *
 * - If assetMint is undefined: performs a SOL airdrop.
 * - Otherwise: currently unsupported for SPL tokens (falling back to SOL).
 */
export async function acquireTestFunds(
  connection: Connection,
  payer: Keypair,
  params: RequestFaucetFundsArgs
): Promise<RequestFaucetFundsResult> {
  const cluster = params.cluster || "devnet"
  const explorerBase =
    cluster === "mainnet-beta"
      ? "https://explorer.solana.com"
      : `https://explorer.solana.com?cluster=${cluster}`

  // SOL airdrop
  if (!params.assetMint) {
    try {
      const lamports = Math.round(params.amount * LAMPORTS_PER_SOL)
      const signature = await connection.requestAirdrop(
        payer.publicKey,
        lamports
      )
      await connection.confirmTransaction(signature, "confirmed")

      return {
        message: `Airdropped ${params.amount} SOL to ${payer.publicKey.toBase58()}`,
        body: {
          transactionSignature: signature,
          explorerLink: `${explorerBase}/tx/${signature}`,
        },
      }
    } catch (err: any) {
      return {
        message: `SOL airdrop failed: ${err.message ?? err}`,
      }
    }
  }

  // SPL token faucet (not supported)
  return {
    message: `SPL faucet unsupported for mint ${params.assetMint}; only SOL airdrops are available.`,
  }
}
