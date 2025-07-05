// moduleRegistry.ts

/**
 * Defines allowed action IDs for type safety.
 */
export type ActionId =
  | "getWalletAddress"
  | "getTokenBalance"
  | "getAllBalances"
  | "resolveTokenMint"
  | "executeTransfer"

/**
 * Maps action IDs to their corresponding module paths.
 * These are loaded dynamically via CommonJS `require`.
 */
export const ModuleRegistry: Record<ActionId, string> = {
  getWalletAddress: "./actions/getWalletAddress.js",
  getTokenBalance: "./actions/getTokenBalance.js",
  getAllBalances: "./actions/getAllBalances.js",
  resolveTokenMint: "./actions/resolveTokenMint.js",
  executeTransfer: "./actions/executeTransfer.js",
}

/**
 * Dynamically loads a registered module by its action ID.
 *
 * @param actionId - The identifier of the action module
 * @returns The required module
 * @throws If the module path is not registered or loading fails
 */
export function loadActionModule(actionId: ActionId): any {
  const modulePath = ModuleRegistry[actionId]
  if (!modulePath) {
    throw new Error(`No mo
