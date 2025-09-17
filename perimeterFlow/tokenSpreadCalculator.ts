import type { DexScreenerTokenPair } from "@/services/dexscreener"
import { getDexScreenerTokenPairs } from "@/services/dexscreener"

export interface AggregatedTokenStats {
  tokenSymbol: string
  tokenAddress: string
  priceUsd: number
  liquidity: number
  txCount24h: number
  volume24h: number
  pairUrl?: string
}

/**
 * Aggregates token stats for Solana-based token pairs retrieved from DexScreener
 * Filters, parses, and sorts by volume
 *
 * @param query - Token name or address to search for
 * @returns Aggregated token stats sorted by volume
 */
export async function aggregateSolanaTokenStats(query: string): Promise<AggregatedTokenStats[]> {
  let pairs: DexScreenerTokenPair[] = []

  try {
    pairs = await getDexScreenerTokenPairs(query)
  } catch (err: any) {
    console.error(`[aggregateSolanaTokenStats] Failed to fetch token pairs: ${err.message}`)
    return []
  }

  if (!Array.isArray(pairs) || pairs.length === 0) {
    console.warn(`[aggregateSolanaTokenStats] No pairs found for query: "${query}"`)
    return []
  }

  const solanaPairs = pairs.filter((pair) => {
    return typeof pair.chainId === "string" && pair.chainId.toLowerCase() === "solana"
  })

  if (solanaPairs.length === 0) {
    console.info(`[aggregateSolanaTokenStats] No Solana pairs matched for: "${query}"`)
    return []
  }

  const result: AggregatedTokenStats[] = solanaPairs.map((pair) => {
    const symbol = pair.baseToken?.symbol ?? "UNKNOWN"
    const address = pair.baseToken?.address ?? ""
    const price = parseFloat(pair.priceUsd || "0")
    const liquidity = pair.liquidity?.usd ?? 0
    const txCount = pair.txCount?.h24 ?? 0
    const volume = pair.volume?.h24 ?? 0

    return {
      tokenSymbol: symbol,
      tokenAddress: address,
      priceUsd: price,
      liquidity,
      txCount24h: txCount,
      volume24h: volume,
      pairUrl: pair.url ?? undefined
    }
  })

  return result.sort((a, b) => b.volume24h - a.volume24h)
}
