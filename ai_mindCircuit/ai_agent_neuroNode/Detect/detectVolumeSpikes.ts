
import fetch from 'node-fetch'

export interface SpikeEvent {
  mint: string
  changePct: number
  windowSize: number
  timestamp: number
}

export async function detectVolumeSpikes(
  mint: string,
  windowSize: number = 50,
  thresholdPct: number = 20
): Promise<SpikeEvent | null> {
  const res = await fetch(
    `https://public-api.solscan.io/account/token/txs?account=${mint}&limit=${windowSize * 2}`
  )
  const data = (await res.json()).data as any[]
  const clean = data.filter(tx => tx.err === null)

  const older = clean.slice(windowSize)
  const recent = clean.slice(0, windowSize)
  const sum = (arr: any[]) => arr.reduce((s, tx) => s + Number(tx.tokenAmount.amount), 0)
  const volOld = sum(older)
  const volNew = sum(recent)
  if (volOld === 0) return null

  const pct = ((volNew - volOld) / volOld) * 100
  if (pct >= thresholdPct) {
    return { mint, changePct: parseFloat(pct.toFixed(2)), windowSize, timestamp: Date.now() }
  }
  return null
}
