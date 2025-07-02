import fetch from 'node-fetch'
import { BaseAeliraAction } from './baseAeliraAction'

export interface AlertConfig {
  mint: string
  thresholdPct: number
  intervalMs: number
}

export class AeliraAlertService extends BaseAeliraAction {
  private lastPrice = 0

  constructor(private cfg: AlertConfig) {
    super('AeliraAlertService')
  }

  /** Poll DexScreener and emit an alert if price moves beyond threshold */
  protected async execute(): Promise<void> {
    setInterval(async () => {
      try {
        const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${this.cfg.mint}`
        const res = await fetch(url)
        const p = (await res.json() as any).pair.priceUsd as string
        const price = parseFloat(p)
        if (
          this.lastPrice > 0 &&
          Math.abs((price - this.lastPrice) / this.lastPrice) * 100 >= this.cfg.thresholdPct
        ) {
          this.emit('alert', {
            mint: this.cfg.mint,
            old: this.lastPrice,
            new: price,
            changePct: ((price - this.lastPrice) / this.lastPrice) * 100
          })
        }
        this.lastPrice = price
      } catch (err) {
        this.emit('error', { action: this.name, error: err })
      }
    }, this.cfg.intervalMs)
  }
}
