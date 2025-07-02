// moduleRegistry.ts

/**
 * Maps action IDs to their module file paths.
 * No static imports here—just a simple lookup table.
 */
export const ModuleRegistry: Record<string, string> = {
  getWalletAddress: './actions/getWalletAddress.js',
  getTokenBalance:   './actions/getTokenBalance.js',
  getAllBalances:    './actions/getAllBalances.js',
  resolveTokenMint:  './actions/resolveTokenMint.js',
  executeTransfer:   './actions/executeTransfer.js',
}

/**
 * Dynamically loads a module using CommonJS require.
 * Throws if the action ID is unknown or the module fails to load.
 */
export function loadActionModule(actionId: string): any {
  const modulePath = ModuleRegistry[actionId]
  if (!modulePath) {
    throw new Error(`No module registered for action "${actionId}"`)
  }
  try {
    // use require instead of import
    return require(modulePath)
  } catch (err) {
    throw new Error(`Failed to load module "${modulePath}": ${err}`)
  }
}
