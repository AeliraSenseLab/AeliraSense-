import type { DexScreenerTokenPair } from "@/services/dexscreener"
import { getDexScreenerTokenPairs } from "@/services/dexscreener"

export interface AggregatedTokenStats {
  tokenSymbol: string
  tokenAddress: string
  priceUsd: number
  liquidity: number
  txCount24h: number
  volume24h: number
}

export async function aggregateSolanaTokenStats(
  query: string
): Promise<AggregatedTokenStats[]> {
  const pairs = await getDexScreenerTokenPairs(query)
  if (!pairs || pairs.length === 0) return []

  return pairs
    .filter((p) => p.chainId === "solana")
    .map((pair) => ({
      tokenSymbol: pair.baseToken.symbol,
      tokenAddress: pair.baseToken.address,
      priceUsd: parseFloat(pair.priceUsd),
      liquidity: pair.liquidity.usd,
      txCount24h: pair.txCount.h24,
      volume24h: pair.volume.h24
    }))
    .sort((a, b) => b.volume24h - a.volume24h)
}
