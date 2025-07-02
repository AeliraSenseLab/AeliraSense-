// config.ts

/**
 * Global scan and detection configuration for the JobWatcher system.
 */
export const SCAN_CONFIG = {
  /** How often to perform a full scan (in ms) */
  intervalMs: 300_000,        // default: 5 minutes
  
  /** How many recent transactions to fetch per address/program */
  maxTxFetch: 500,            // default: 500 transactions
  
  /** Minimum token amount to flag as a “whale” movement */
  whaleThreshold: 50_000,     // default: 50K tokens
}

/**
 * Activity detection windows and thresholds.
 */
export const DETECTION_PARAMS = {
  /** Time window (ms) to identify sudden activity bursts */
  flashWindowMs: 120_000,     // default: 2 minutes
  
  /** Risk score above which an alert is emitted (0.0–1.0) */
  riskAlertThreshold: 0.9,    // default: 90%
  
  /** Minimum on-chain liquidity (in tokens) to include in monitoring */
  minLiquidity: 10_000,       // default: 10K tokens
}

/**
 * Named channels or topics for emitting alerts.
 */
export const ALERT_TOPICS = {
  whales:    "jobwatcher/alerts/whales",
  tokens:    "jobwatcher/alerts/tokens",
  flashPumps:"jobwatcher/alerts/flash-pumps",
}
