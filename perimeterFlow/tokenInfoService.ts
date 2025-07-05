interface TruncateOptions {
  prefixLength?: number
  suffixLength?: number
  fallback?: string
  showFullOnHover?: boolean // for future UI integration
}

/**
 * Truncates a wallet address with optional prefix/suffix preservation.
 *
 * @param address - The full address string
 * @param options - Customization options
 * @returns A truncated address string or fallback
 */
export const truncateAddress = (
  address: string | undefined | null,
  options: TruncateOptions = {}
): string => {
  const {
    prefixLength = 6,
    suffixLength = 6,
    fallback = "Unknown",
    showFullOnHover = false
  } = options

  if (
    !address ||
    typeof address !== "string" ||
    address.length < prefixLength + suffixLength + 3
  ) {
    console.warn(`[truncateAddress] Invalid or short address:`, address)
    return fallback
  }

  const prefix = address.slice(0, prefixLength)
  const suffix = address.slice(-suffixLength)
  const truncated = `${prefix}...${suffix}`

  // Potential future use for tooltip logic
  if (showFullOnHover) {
    // e.g. <span title={address}>{truncated}</span> in UI context
    return truncated // logic is frontend-specific
  }

  return truncated
}
