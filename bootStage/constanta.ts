/** Configuration for full-chain scanning behavior */
export interface ScanConfig {
  /** How often to perform a full scan (ms) */
  readonly intervalMs: number
  /** How many recent transactions to fetch per address/program */
  readonly maxTxFetch: number
  /** Minimum token amount to flag as a "whale" movement */
  readonly whaleThreshold: number
}

/** Activity detection windows and thresholds */
export interface DetectionParams {
  /** Time window (ms) to identify sudden activity bursts */
  readonly flashWindowMs: number
  /** Risk score above which an alert is emitted (0.0–1.0) */
  readonly riskAlertThreshold: number
  /** Minimum on-chain liquidity (in tokens) to include in monitoring */
  readonly minLiquidity: number
}

/** Named channels or topics for emitting alerts */
export interface AlertTopics {
  readonly whales: string
  readonly tokens: string
  readonly flashPumps: string
}

/**
 * Load a numeric environment variable (fallback to default if missing or invalid)
 */
function envNumber(name: string, fallback: number): number {
  const val = Number(process.env[name])
  if (isNaN(val) || val <= 0) {
    console.warn(`[CONFIG] Invalid or missing ${name}, using fallback: ${fallback}`)
    return fallback
  }
  return val
}

/**
 * Load a string environment variable (fallback to default if missing)
 */
function envString(name: string, fallback: string): string {
  const val = process.env[name]?.trim()
  if (!val) {
    console.warn(`[CONFIG] Invalid or missing ${name}, using fallback: ${fallback}`)
    return fallback
  }
  return val
}

/**
 * Validate that thresholds are consistent
 */
function validateConfig(cfg: { scan: ScanConfig; detection: DetectionParams }): void {
  if (cfg.scan.whaleThreshold < cfg.detection.minLiquidity) {
    console.warn("[CONFIG] Whale threshold is below minimum liquidity; consider raising it")
  }
  if (cfg.detection.riskAlertThreshold <= 0 || cfg.detection.riskAlertThreshold > 1) {
    throw new Error("[CONFIG] riskAlertThreshold must be between 0 and 1")
  }
}

/**
 * Primary configuration object (frozen to prevent runtime mutation)
 */
export const CONFIG = (() => {
  const config = {
    scan: Object.freeze<ScanConfig>({
      intervalMs: envNumber("SCAN_INTERVAL_MS", 300_000),
      maxTxFetch: envNumber("SCAN_MAX_TX_FETCH", 500),
      whaleThreshold: envNumber("SCAN_WHALE_THRESHOLD", 50_000),
    }),

    detection: Object.freeze<DetectionParams>({
      flashWindowMs: envNumber("DETECTION_FLASH_WINDOW_MS", 120_000),
      riskAlertThreshold: envNumber("DETECTION_RISK_ALERT_THRESHOLD", 0.9),
      minLiquidity: envNumber("DETECTION_MIN_LIQUIDITY", 10_000),
    }),

    alerts: Object.freeze<AlertTopics>({
      whales: envString("ALERT_TOPIC_WHALES", "jobwatcher/alerts/whales"),
      tokens: envString("ALERT_TOPIC_TOKENS", "jobwatcher/alerts/tokens"),
      flashPumps: envString("ALERT_TOPIC_FLASH", "jobwatcher/alerts/flash-pumps"),
    }),
  } as const

  validateConfig(config)
  return Object.freeze(config)
})()

/** Usage:
 *  import { CONFIG } from './scan_config'
 *  console.log(CONFIG.scan.intervalMs)
 */
