/** Configuration for full-chain scanning behavior */
export interface ScanConfig {
  /** How often to perform a full scan (ms) */
  readonly intervalMs: number
  /** How many recent transactions to fetch per address/program */
  readonly maxTxFetch: number
  /** Minimum token amount to flag as a “whale” movement */
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
  return isFinite(val) && val > 0 ? val : fallback
}

/**
 * Primary configuration object (frozen to prevent runtime mutation)
 */
export const CONFIG = Object.freeze({
  scan: Object.freeze<ScanConfig>({
    intervalMs: envNumber('SCAN_INTERVAL_MS', 300_000),
    maxTxFetch: envNumber('SCAN_MAX_TX_FETCH', 500),
    whaleThreshold: envNumber('SCAN_WHALE_THRESHOLD', 50_000),
  }),
  detection: Object.freeze<DetectionParams>({
    flashWindowMs: envNumber('DETECTION_FLASH_WINDOW_MS', 120_000),
    riskAlertThreshold: envNumber('DETECTION_RISK_ALERT_THRESHOLD', 0.9),
    minLiquidity: envNumber('DETECTION_MIN_LIQUIDITY', 10_000),
  }),
  alerts: Object.freeze<AlertTopics>({
    whales:    process.env.ALERT_TOPIC_WHALES    ?? "jobwatcher/alerts/whales",
    tokens:    process.env.ALERT_TOPIC_TOKENS    ?? "jobwatcher/alerts/tokens",
    flashPumps:process.env.ALERT_TOPIC_FLASH     ?? "jobwatcher/alerts/flash-pumps",
  }),
} as const)

/** Usage:
 *  import { CONFIG } from './config'
 *  console.log(CONFIG.scan.intervalMs)
 */
