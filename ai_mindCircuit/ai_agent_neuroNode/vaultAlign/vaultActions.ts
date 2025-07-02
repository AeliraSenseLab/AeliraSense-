import { z } from "zod"
import {
  AELIRA_ALL_BALANCES_NAME,
  AELIRA_BALANCE_NAME,
  AELIRA_RESOLVE_MINT_NAME,
  AELIRA_SCAN_WALLETS_NAME,
  AELIRA_TRANSFER_NAME
} from "@/aelirasense/action-names"
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction
} from "@solana/web3.js"
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createTransferInstruction
} from "@solana/spl-token"

/* ========= Types ========= */

export interface VaultActionResponse<T> {
  notice: string
  data?: T
}

export interface ExecutionContext {
  connection: Connection
  walletPubkey: PublicKey
  sendTransaction: (tx: Transaction) => Promise<string>
}

export interface VaultActionCore<S extends z.ZodTypeAny, R> {
  id: string
  summary: string
  input: S
  execute: (args: { payload: z.infer<S>; context: ExecutionContext }) => Promise<VaultActionResponse<R>>
}

/* ========= 1. Scan wallet address ========= */

export const scanWalletsAction: VaultActionCore<
  z.ZodObject<{}>,
  { wallets: string[] }
> = {
  id: AELIRA_SCAN_WALLETS_NAME,
  summary: "Discover all token accounts for the connected wallet",
  input: z.object({}),
  execute: async ({ context }) => {
    const resp = await context.connection.getParsedTokenAccountsByOwner(
      context.walletPubkey,
      { programId: TOKEN_PROGRAM_ID }
    )
    const wallets = resp.value.map(acc =>
      (acc.account.data as any).parsed.info.mint as string
    )
    return {
      notice: "Token accounts scanned",
      data: { wallets }
    }
  }
}

/* ========= 2. Single-token balance ========= */

export const queryBalanceAction: VaultActionCore<
  z.ZodObject<{ mint: z.ZodString }>,
  { balance: number }
> = {
  id: AELIRA_BALANCE_NAME,
  summary: "Fetch SOL or SPL token balance",
  input: z.object({ mint: z.string() }),
  execute: async ({ payload, context }) => {
    if (payload.mint === "SOL") {
      const lamports = await context.connection.getBalance(context.walletPubkey)
      return {
        notice: "SOL balance fetched",
        data: { balance: lamports / LAMPORTS_PER_SOL }
      }
    }

    const mint = new PublicKey(payload.mint)
    const ata = getAssociatedTokenAddressSync(mint, context.walletPubkey)
    const info = await context.connection.getParsedAccountInfo(ata)
    const ui = info.value?.data && "parsed" in info.value.data
      ? (info.value.data.parsed.info.tokenAmount.uiAmount as number)
      : 0

    return {
      notice: "Token balance fetched",
      data: { balance: ui }
    }
  }
}

/* ========= 3. All balances ========= */

export const listAllBalancesAction: VaultActionCore<
  z.ZodObject<{}>,
  { balances: Record<string, number> }
> = {
  id: AELIRA_ALL_BALANCES_NAME,
  summary: "Fetch SOL plus all SPL token balances",
  input: z.object({}),
  execute: async ({ context }) => {
    const balances: Record<string, number> = {}
    // SOL
    const solLamports = await context.connection.getBalance(context.walletPubkey)
    balances.SOL = solLamports / LAMPORTS_PER_SOL
    // SPL tokens
    const resp = await context.connection.getParsedTokenAccountsByOwner(
      context.walletPubkey,
      { programId: TOKEN_PROGRAM_ID }
    )
    resp.value.forEach(acc => {
      const { mint, tokenAmount } = (acc.account.data as any).parsed.info
      balances[mint] = tokenAmount.uiAmount as number
    })
    return {
      notice: "All balances fetched",
      data: { balances }
    }
  }
}

/* ========= 4. Resolve mint by symbol ========= */

const MINT_DIRECTORY: Record<string, string> = {
  USDC: "Es9vMFrzaC1...",
  RAY:  "4k3Dyjzvzp8..."
}

export const resolveMintAction: VaultActionCore<
  z.ZodObject<{ symbol: z.ZodString }>,
  { mint: string }
> = {
  id: AELIRA_RESOLVE_MINT_NAME,
  summary: "Resolve an SPL token’s mint address by its symbol",
  input: z.object({ symbol: z.string() }),
  execute: async ({ payload }) => {
    const mint = MINT_DIRECTORY[payload.symbol.toUpperCase()]
    if (!mint) {
      throw new Error(`Unknown symbol: ${payload.symbol}`)
    }
    return {
      notice: "Mint address resolved",
      data: { mint }
    }
  }
}

/* ========= 5. Transfer asset ========= */

export const transferAssetAction: VaultActionCore<
  z.ZodObject<{
    to: z.ZodString
    amount: z.ZodNumber
    mint: z.ZodString
  }>,
  { txSignature: string }
> = {
  id: AELIRA_TRANSFER_NAME,
  summary: "Transfer SOL or SPL tokens",
  input: z.object({
    to: z.string(),
    amount: z.number().positive(),
    mint: z.string()
  }),
  execute: async ({ payload, context }) => {
    const recipient = new PublicKey(payload.to)
    const tx = new Transaction()
    if (payload.mint === "SOL") {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: context.walletPubkey,
          toPubkey: recipient,
          lamports: payload.amount * LAMPORTS_PER_SOL
        })
      )
    } else {
      const mint = new PublicKey(payload.mint)
      const fromAta = getAssociatedTokenAddressSync(mint, context.walletPubkey)
      const toAta = getAssociatedTokenAddressSync(mint, recipient)
      tx.add(
        createTransferInstruction(
          fromAta,
          toAta,
          context.walletPubkey,
          payload.amount,
          [],
          TOKEN_PROGRAM_ID
        )
      )
    }
    const signature = await context.sendTransaction(tx)
    return {
      notice: "Transfer completed",
      data: { txSignature: signature }
    }
  }
}
