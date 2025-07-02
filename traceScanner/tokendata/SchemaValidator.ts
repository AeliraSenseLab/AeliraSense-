
import { z } from 'zod'

export const HolderSchema = z.object({
  address: z.string().regex(/^[A-Za-z0-9]{32,44}$/, 'Invalid Solana address'),
  amount: z.number().nonnegative()
})

export const BehaviorMetricsSchema = z.object({
  totalTxns: z.number().int().nonnegative(),
  transferCount: z.number().int().nonnegative(),
  averageAmount: z.number().nonnegative(),
  activeDays: z.number().int().nonnegative()
})

export type Holder = z.infer<typeof HolderSchema>
export type BehaviorMetrics = z.infer<typeof BehaviorMetricsSchema>

/**
 * Validate raw data against schemas, throwing if invalid.
 */
export function validateWalletData(
  holders: unknown,
  behavior: unknown
): { holders: Holder[]; behavior: BehaviorMetrics } {
  const parsedHolders = z.array(HolderSchema).parse(holders)
  const parsedBehavior = BehaviorMetricsSchema.parse(behavior)
  return {
    holders: parsedHolders,
    behavior: parsedBehavior
  }
}
