export interface TruncateOptions {
  /** Number of leading characters to keep (non-negative integer) */
  prefixLength?: number
  suffixLength?: number
  fallback?: string
  /** The separator placed between prefix and suffix */
  ellipsis?: string
  /** Reserved for UI integrations that may show a tooltip */
  showFullOnHover?: boolean
  /** Optional warning hook instead of console.warn */
  warn?: (message: string) => void
  /** Trim surrounding whitespace from the input before processing */
  trim?: boolean
}

/**
 * Safely truncates an address-like string by preserving a prefix and suffix
 * and inserting a customizable ellipsis between them
 *
 * Design goals:
 * - Pure and side-effect free (no console noise unless you pass `warn`)
 * - Defensive option normalization
 * - Never returns a longer string than the input
 * - Gracefully handles edge cases (short strings, zero prefix/suffix, empty ellipsis)
 */
export const truncateAddress = (
  address: string | null | undefined,
  options: TruncateOptions = {}
): string => {
  const defaults: Required<Omit<TruncateOptions, 'warn' | 'showFullOnHover'>> & Pick<TruncateOptions, 'warn' | 'showFullOnHover'> = {
    prefixLength: 6,
    suffixLength: 6,
    fallback: 'Unknown',
    ellipsis: '…',
    trim: true,
    warn: undefined,
    showFullOnHover: false
  }

  const opts = Object.freeze({ ...defaults, ...options })

  if (typeof address !== 'string' || address.length === 0) {
    if (opts.warn) opts.warn('[truncateAddress] No address provided')
    return opts.fallback
  }

  const input = opts.trim ? address.trim() : address

  const pre = Number.isFinite(opts.prefixLength) ? Math.max(0, Math.floor(opts.prefixLength!)) : defaults.prefixLength
  const suf = Number.isFinite(opts.suffixLength) ? Math.max(0, Math.floor(opts.suffixLength!)) : defaults.suffixLength

  const ellipsis = typeof opts.ellipsis === 'string' ? opts.ellipsis : defaults.ellipsis

  const glyphs = Array.from(input)
  const minNeeded = pre + suf + (ellipsis ? Array.from(ellipsis).length : 0)

  if (glyphs.length <= minNeeded || (pre === 0 && suf === 0)) {
    return input
  }

  const head = glyphs.slice(0, pre).join('')
  const tail = glyphs.slice(-suf).join('')

  const truncated = `${head}${ellipsis}${tail}`

  return truncated.length < input.length ? truncated : input
}

/**
 * Convenience helper for common 4-4 truncation, e.g. ABCD…WXYZ
 */
export const truncate44 = (
  address: string | null | undefined,
  opts?: Omit<TruncateOptions, 'prefixLength' | 'suffixLength'>
) => truncateAddress(address, { ...opts, prefixLength: 4, suffixLength: 4 })

/**
 * Convenience helper for compact 3-3 truncation, e.g. ABC…XYZ
 */
export const truncate33 = (
  address: string | null | undefined,
  opts?: Omit<TruncateOptions, 'prefixLength' | 'suffixLength'>
) => truncateAddress(address, { ...opts, prefixLength: 3, suffixLength: 3 })
