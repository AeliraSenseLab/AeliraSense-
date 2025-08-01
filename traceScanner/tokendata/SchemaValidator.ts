import { z } from 'zod'

// Holder schema with refined Solana address length and descriptions
export const HolderSchema = z.object({
  address: z
    .string()
    .regex(/^[A-Za-z0-9]{32,44}$/, 'Invalid Solana address length or format'),
  amount: z.number().nonnegative().describe('Token amount held by the address'),
})

export const BehaviorMetricsSchema = z.object({
  totalTxns: z
    .number()
    .int()
    .nonnegative()
    .describe('Total number of transactions'),
  transferCount: z
    .number()
    .int()
    .nonnegative()
    .describe('Number of transfer transactions'),
  averageAmount: z
    .number()
    .nonnegative()
    .describe('Average amount per transaction'),
  activeDays: z
    .number()
    .int()
    .nonnegative()
    .describe('Number of days with at least one transaction'),
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
  return { holders: parsedHolders, behavior: parsedBehavior }
}

/**
 * Safely validate raw wallet data without throwing.
 * Returns success flag and either parsed data or combined Zod errors.
 */
export function safeValidateWalletData(
  holders: unknown,
  behavior: unknown
):
  | { success: true; data: { holders: Holder[]; behavior: BehaviorMetrics } }
  | { success: false; errors: z.ZodError } {
  const holdersResult = z.array(HolderSchema).safeParse(holders)
  const behaviorResult = BehaviorMetricsSchema.safeParse(behavior)

  if (!holdersResult.success || !behaviorResult.success) {
    const combinedError = new z.ZodError([
      ...(holdersResult.success ? [] : holdersResult.error.issues),
      ...(behaviorResult.success ? [] : behaviorResult.error.issues),
    ])
    return { success: false, errors: combinedError }
  }

  return {
    success: true,
    data: {
      holders: holdersResult.data,
      behavior: behaviorResult.data,
    },
  }
}
