// /tokeninsights/tokenPatternDetector.ts
import fetch from 'node-fetch'

export interface PatternEvent {
  type: 'whale' | 'pump' | 'dump'
  timestamp: number
  amountChange: number
}

/**
 * Detects simple patterns: large “whale” transfers, sudden
 * volume pumps or dumps by comparing last 2 windows.
 */
export async function tokenPatternDetector(
  mint: string,
  windowSize: number = 100,
  pumpThresholdPct: number = 20,
  dumpThresholdPct: number = 20,
  whaleSize: number = 100_000
): Promise<PatternEvent[]> {
  // fetch last 2*windowSize transfers
  const url = `https://public-api.solscan.io/account/token/txs?account=${mint}&limit=${windowSize * 2}`
  const res = await fetch(url)
  const data = (await res.json()).data as any[]
  const transfers = data.filter(tx => tx.err === null)

  // split into two windows
  const older = transfers.slice(windowSize)
  const recent = transfers.slice(0, windowSize)

  const sumOlder = older.reduce((s, tx) => s + Number(tx.tokenAmount.amount), 0)
  const sumRecent = recent.reduce((s, tx) => s + Number(tx.tokenAmount.amount), 0)
  const pctChange = sumOlder === 0 ? 0 : (sumRecent - sumOlder) / sumOlder * 100

  const events: PatternEvent[] = []

  // whale transfers in recent window
  recent.forEach(tx => {
    const amt = Number(tx.tokenAmount.amount)
    if (amt >= whaleSize) {
      events.push({ type: 'whale', timestamp: Date.now(), amountChange: amt })
    }
  })

  // pump or dump
  if (pctChange >= pumpThresholdPct) {
    events.push({ type: 'pump', timestamp: Date.now(), amountChange: pctChange })
  } else if (pctChange <= -dumpThresholdPct) {
    events.push({ type: 'dump', timestamp: Date.now(), amountChange: pctChange })
  }

  return events
}
