
import { fetchRecentTransfers, TransferEvent } from './tokenTradeMonitor'

export interface HeatmapPoint {
  hourUTC: number
  count: number
}

/**
 * Aggregates transfer events into a 24-hour hourly heatmap.
 */
export async function generateTransferHeatmap(
  mint: string,
  lookback: number = 500
): Promise<HeatmapPoint[]> {
  const events: TransferEvent[] = await fetchRecentTransfers(mint, lookback)
  const buckets = new Map<number, number>()

  events.forEach(evt => {
    const hour = new Date(evt.slot * 1000).getUTCHours()
    buckets.set(hour, (buckets.get(hour) || 0) + 1)
  })

  return Array.from(buckets.entries())
    .map(([hourUTC, count]) => ({ hourUTC, count }))
    .sort((a, b) => a.hourUTC - b.hourUTC)
}
