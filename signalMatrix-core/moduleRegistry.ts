// moduleRegistry.ts

/**
 * Defines allowed action IDs for type safety.
 */
export type ActionId =
  | "getWalletAddress"
  | "getTokenBalance"
  | "getAllBalances"
  | "resolveTokenMint"
  | "executeTransfer";

/**
 * Represents a dynamically loaded action module.
 * Each module should export a default function matching this signature.
 */
export type ActionFunction = (...args: any[]) => Promise<any>;

/**
 * Maps action IDs to their corresponding module file paths.
 * These files should export a default function.
 */
const ModuleRegistry: Record<ActionId, string> = {
  getWalletAddress: "./actions/getWalletAddress.js",
  getTokenBalance: "./actions/getTokenBalance.js",
  getAllBalances: "./actions/getAllBalances.js",
  resolveTokenMint: "./actions/resolveTokenMint.js",
  executeTransfer: "./actions/executeTransfer.js",
};

/**
 * Returns a list of all registered action IDs.
 */
export function listAvailableActions(): ActionId[] {
  return Object.keys(ModuleRegistry) as ActionId[];
}

/**
 * Dynamically loads and returns the action function for the given action ID.
 *
 * @param actionId - The identifier of the action module to load.
 * @returns A Promise resolving to the action function.
 * @throws If the action ID is not registered or if loading fails.
 */
export async function loadActionModule(actionId: ActionId): Promise<ActionFunction> {
  const modulePath = ModuleRegistry[actionId];

  if (!modulePath) {
    throw new Error(`[moduleRegistry] Action ID "${actionId}" is not registered.`);
  }

  try {
    // Use dynamic ES module import
    const module = await import(/* webpackIgnore: true */ modulePath);
    if (!module || typeof module.default !== "function") {
      throw new Error(`[moduleRegistry] Module at "${modulePath}" does not export a default function.`);
    }

    return module.default as ActionFunction;
  } catch (err: any) {
    throw new Error(`[moduleRegistry] Failed to load module for "${actionId}" from "${modulePath}": ${err.message}`);
  }
}

/**
 * Example usage:
 * 
 * (async () => {
 *   try {
 *     const action = await loadActionModule("getWalletAddress");
 *     const address = await action("userPublicKey");
 *     console.log("Wallet Address:", address);
 *   } catch (error) {
 *     console.error(error);
 *   }
 * })();
 */

// Export registry for introspection if needed
export { ModuleRegistry };
