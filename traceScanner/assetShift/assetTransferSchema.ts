// /assetflow/assetTransferSchema.ts

import { z } from 'zod'

/**
 * Zod schema for asset transfer parameters
 */
export const AssetTransferSchema = z.object({
  recipient: z
    .string()
    .regex(/^[A-Za-z0-9]{32,44}$/, 'Invalid Solana address'),
  assetSymbol: z
    .string()
    .refine(sym => Object.keys(AssetTypeMap).includes(sym.toUpperCase()), {
      message: 'Unknown asset symbol'
    }),
  amount: z
    .number()
    .positive('Transfer amount must be positive')
})

export type AssetTransferParams = z.infer<typeof AssetTransferSchema>
