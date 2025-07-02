// /riskanalysis/burstPredictor.ts
import { activityHeatmap, HeatmapPoint } from './activityHeatmap'

export interface BurstEvent {
  mint: string
  hourUTC: number
  ratio: number       // recent vs historical average
  timestamp: number
}

/**
 * Predicts sudden bursts: compares last hour's activity
 * to the average of the preceding hours.
 */
export async function burstPredictor(
  mint: string,
  lookbackHours: number = 24
): Promise<BurstEvent[]> {
  const heatmap: HeatmapPoint[] = await activityHeatmap(mint, lookbackHours * 50)
  if (heatmap.length < 2) return []

  // compute average excluding last
  const last = heatmap[heatmap.length - 1]
  const prior = heatmap.slice(0, -1)
  const avg = prior.reduce((s, p) => s + p.txCount, 0) / prior.length || 1
  const ratio = last.txCount / avg

  const events: BurstEvent[] = []
  if (ratio > 2) { // arbitrary burst threshold
    events.push({
      mint,
      hourUTC: last.hourUTC,
      ratio: parseFloat(ratio.toFixed(2)),
      timestamp: Date.now()
    })
  }
  return events
}
