
export interface HeatmapPoint {
  hourUTC: number
  txCount: number
}

/**
 * Builds a 24-hour heatmap of transfer activity for a token.
 */
export async function activityHeatmap(
  mint: string,
  lookback: number = 500
): Promise<HeatmapPoint[]> {
  const events: TransferEvent[] = await fetchRecentTransfers(mint, lookback)
  const buckets = new Map<number, number>()

  events.forEach(evt => {
    const hour = new Date((evt.slot || 0) * 1000).getUTCHours()
    buckets.set(hour, (buckets.get(hour) || 0) + 1)
  })

  return Array.from(buckets.entries())
    .map(([hourUTC, txCount]) => ({ hourUTC, txCount }))
    .sort((a, b) => a.hourUTC - b.hourUTC)
}
