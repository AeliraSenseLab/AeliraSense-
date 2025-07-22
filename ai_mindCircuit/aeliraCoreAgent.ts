// aeliraCoreAgent.ts

import { Connection, PublicKey, Commitment } from '@solana/web3.js'

export interface Logger {
  info(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  error(message: string, ...args: any[]): void
}

class ConsoleLogger implements Logger {
  info(msg: string, ...args: any[]) { console.info(`[AeliraCore] ${msg}`, ...args) }
  warn(msg: string, ...args: any[]) { console.warn(`[AeliraCore] ${msg}`, ...args) }
  error(msg: string, ...args: any[]) { console.error(`[AeliraCore] ${msg}`, ...args) }
}

export interface AeliraOptions {
  commitment?: Commitment
  retryAttempts?: number
  retryDelayMs?: number
  timeoutMs?: number
  logger?: Logger
  cacheTtlMs?: number
}

/** AeliraSense core agent for on-chain data access */
export class AeliraCoreAgent {
  private conn: Connection
  private logger: Logger
  private retryAttempts: number
  private retryDelayMs: number
  private timeoutMs: number
  private cacheTtlMs: number
  private solCache = new Map<string, { ts: number, balance: number }>()
  private tokenCache = new Map<string, { ts: number, balance: number }>()

  constructor(rpcUrl: string, options: AeliraOptions = {}) {
    const {
      commitment = 'confirmed',
      retryAttempts = 2,
      retryDelayMs = 300,
      timeoutMs = 5000,
      cacheTtlMs = 60_000,
      logger = new ConsoleLogger(),
    } = options

    this.conn = new Connection(rpcUrl, commitment)
    this.logger = logger
    this.retryAttempts = retryAttempts
    this.retryDelayMs = retryDelayMs
    this.timeoutMs = timeoutMs
    this.cacheTtlMs = cacheTtlMs
  }

  /** Fetch SOL balance (in SOL), with caching, retry, and timeout */
  public async getSolBalance(address: string): Promise<number> {
    const cacheKey = `sol:${address}`
    const now = Date.now()

    // return from cache if fresh
    const cached = this.solCache.get(cacheKey)
    if (cached && now - cached.ts < this.cacheTtlMs) {
      this.logger.info(`Cache hit for SOL ${address}`)
      return cached.balance
    }

    const lamports = await this.callWithRetry(() =>
      this.withTimeout(
        this.conn.getBalance(new PublicKey(address)), 
        this.timeoutMs, 
        `getBalance(${address})`
      )
    )

    const sol = lamports / 1e9
    this.solCache.set(cacheKey, { ts: now, balance: sol })
    this.logger.info(`Fetched SOL balance for ${address}: ${sol}`)
    return sol
  }

  /** Fetch SPL token balance (in token units), with caching, retry, and timeout */
  public async getTokenBalance(owner: string, mint: string): Promise<number> {
    const cacheKey = `token:${owner}:${mint}`
    const now = Date.now()

    const cached = this.tokenCache.get(cacheKey)
    if (cached && now - cached.ts < this.cacheTtlMs) {
      this.logger.info(`Cache hit for token ${mint} @ ${owner}`)
      return cached.balance
    }

    const resp = await this.callWithRetry(() =>
      this.withTimeout(
        this.conn.getTokenAccountsByOwner(
          new PublicKey(owner),
          { mint: new PublicKey(mint) },
          { encoding: 'jsonParsed' }
        ),
        this.timeoutMs,
        `getTokenAccountsByOwner(${owner},${mint})`
      )
    )

    const uiAmount = resp.value[0]?.account.data.parsed.info.tokenAmount.uiAmount ?? 0
    this.tokenCache.set(cacheKey, { ts: now, balance: uiAmount })
    this.logger.info(`Fetched token balance for ${mint} @ ${owner}: ${uiAmount}`)
    return uiAmount
  }

  /** Helper: retry an async function with delay */
  private async callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        return await fn()
      } catch (err) {
        lastError = err
        this.logger.warn(`Attempt ${attempt + 1} failed`, err)
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelayMs * (attempt + 1))
        }
      }
    }
    this.logger.error('All retry attempts failed', lastError)
    throw lastError
  }

  /** Helper: wrap a promise with timeout */
  private withTimeout<T>(promise: Promise<T>, ms: number, opName: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = setTimeout(() => {
        reject(new Error(`Timeout after ${ms}ms in ${opName}`))
      }, ms)
      promise
        .then(res => {
          clearTimeout(id)
          resolve(res)
        })
        .catch(err => {
          clearTimeout(id)
          reject(err)
        })
    })
  }

  /** Helper: simple delay */
  private delay(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms))
  }
}
