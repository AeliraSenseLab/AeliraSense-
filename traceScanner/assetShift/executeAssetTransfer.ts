// /assetflow/executeAssetTransfer.ts

import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddressSync
} from '@solana/spl-token'
import { AssetTypeMap } from './assetTypeMap'
import { AssetTransferSchema, AssetTransferParams } from './assetTransferSchema'

export async function executeAssetTransfer(
  params: unknown,
  context: {
    connection: Connection
    payer: Keypair
  }
): Promise<{ success: boolean; txSignature?: string; error?: string }> {
  // Validate input
  const parse = AssetTransferSchema.safeParse(params)
  if (!parse.success) {
    return { success: false, error: parse.error.errors.map(e => e.message).join('; ') }
  }
  const { recipient, assetSymbol, amount } = parse.data
  const symbol = assetSymbol.toUpperCase()

  // Lookup mint and decimals
  const asset = AssetTypeMap[symbol]
  if (!asset) {
    return { success: false, error: `No mapping for asset ${symbol}` }
  }

  const { mint, decimals } = asset
  const recipientPubkey = new PublicKey(recipient)
  const tx = new Transaction()

  if (symbol === 'SOL') {
    const lamports = Math.round(amount * 10 ** decimals)
    tx.add(
      SystemProgram.transfer({
        fromPubkey: context.payer.publicKey,
        toPubkey: recipientPubkey,
        lamports
      })
    )
  } else {
    const mintPubkey = new PublicKey(mint)
    const fromAta = getAssociatedTokenAddressSync(mintPubkey, context.payer.publicKey)
    const toAta = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey)
    const tokenAmount = BigInt(Math.round(amount * 10 ** decimals))

    tx.add(
      createTransferInstruction(
        fromAta,
        toAta,
        context.payer.publicKey,
        tokenAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    )
  }

  try {
    const signature = await context.connection.sendTransaction(tx, [context.payer])
    return { success: true, txSignature: signature }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
