export interface TruncateOptions {
  prefixLength?: number
  suffixLength?: number
  fallback?: string
  ellipsis?: string
  showFullOnHover?: boolean // reserved for UI integration
}

/**
 * Truncates a wallet address, preserving a prefix and suffix,
 * and inserts a customizable ellipsis in between.
 *
 * @param address     The full address string
 * @param options     Customization options
 * @returns           Truncated address or fallback string
 */
export const truncateAddress = (
  address: string | null | undefined,
  options: TruncateOptions = {}
): string => {
  const {
    prefixLength = 6,
    suffixLength = 6,
    fallback = 'Unknown',
    ellipsis = '…',
    showFullOnHover = false
  } = options

  if (!address || typeof address !== 'string') {
    console.warn('[truncateAddress] No address provided')
    return fallback
  }

  // Ensure lengths are non-negative integers
  const pre = Math.max(0, Math.floor(prefixLength))
  const suf = Math.max(0, Math.floor(suffixLength))
  const minLength = pre + suf + ellipsis.length

  if (address.length <= minLength) {
    // Too short to truncate usefully
    return address
  }

  const head = address.slice(0, pre)
  const tail = address.slice(-suf)
  const truncated = `${head}${ellipsis}${tail}`

  if (showFullOnHover) {
    // UI layer can render `<span title={address}>{truncated}</span>`
    return truncated
  }

  return truncated
}
