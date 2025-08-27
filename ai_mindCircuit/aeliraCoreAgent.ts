import { Connection, PublicKey, Commitment, GetProgramAccountsFilter } from '@solana/web3.js'

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

export interface BalanceOptions {
  /** Override default commitment for this call */
  commitment?: Commitment
  /** Bypass cache and force RPC call */
  forceRefresh?: boolean
  /** Per-call timeout override */
  timeoutMs?: number
}

type CacheEntry = { ts: number; value: number }

/** AeliraSense core agent for on-chain data access */
export class AeliraCoreAgent {
  private conn: Connection
  private logger: Logger
  private retryAttempts: number
  private retryDelayMs: number
  private timeoutMs: number
  private cacheTtlMs: number

  private solCache = new Map<string, CacheEntry>()
  private tokenCache = new Map<string, CacheEntry>()

  /** Coalescing map to dedupe concurrent identical in-flight calls */
  private inflight = new Map<string, Promise<number>>()

  constructor(rpcUrl: string, options: AeliraOptions = {}) {
    const {
      commitment = 'confirmed',
      retryAttempts = 2,
      retryDelayMs = 300,
      timeoutMs = 5_000,
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

  /** Clear all cached balances */
  public clearCache(): void {
    this.solCache.clear()
    this.tokenCache.clear()
  }

  /** Fetch SOL balance (in SOL) with caching, retry, timeout, and in-flight coalescing */
  public async getSolBalance(address: string, opts: BalanceOptions = {}): Promise<number> {
    const owner = this.toPublicKey(address, 'getSolBalance')
    const key = this.cacheKey('sol', owner.toBase58(), undefined, opts)
    const now = Date.now()

    if (!opts.forceRefresh) {
      const cached = this.solCache.get(key)
      if (cached && now - cached.ts < this.cacheTtlMs) {
        this.logger.info(`Cache hit SOL ${owner.toBase58()}`)
        return cached.value
      }
    }

    const existing = this.inflight.get(key)
    if (existing) return existing

    const task = this.callWithRetry(async () => {
      const commitment = opts.commitment ?? this.conn.commitment
      const lamports = await this.withTimeout(
        this.conn.getBalance(owner, commitment),
        opts.timeoutMs ?? this.timeoutMs,
        `getBalance(${owner.toBase58()})`
      )
      const sol = lamports / 1e9
      return sol
    }).finally(() => this.inflight.delete(key))

    this.inflight.set(key, task)
    const sol = await task
    this.solCache.set(key, { ts: now, value: sol })
    this.logger.info(`Fetched SOL ${owner.toBase58()}: ${sol}`)
    return sol
  }

  /**
   * Fetch SPL token balance (in UI units) for owner+mint
   * Sums across all token accounts for the mint
   */
  public async getTokenBalance(ownerAddr: string, mintAddr: string, opts: BalanceOptions = {}): Promise<number> {
    const owner = this.toPublicKey(ownerAddr, 'getTokenBalance(owner)')
    const mint = this.toPublicKey(mintAddr, 'getTokenBalance(mint)')

    const key = this.cacheKey('token', owner.toBase58(), mint.toBase58(), opts)
    const now = Date.now()

    if (!opts.forceRefresh) {
      const cached = this.tokenCache.get(key)
      if (cached && now - cached.ts < this.cacheTtlMs) {
        this.logger.info(`Cache hit token ${mint.toBase58()} @ ${owner.toBase58()}`)
        return cached.value
      }
    }

    const existing = this.inflight.get(key)
    if (existing) return existing

    const task = this.callWithRetry(async () => {
      const commitment = opts.commitment ?? this.conn.commitment
      const resp = await this.withTimeout(
        this.conn.getTokenAccountsByOwner(
          owner,
          { mint },
          { encoding: 'jsonParsed', commitment }
        ),
        opts.timeoutMs ?? this.timeoutMs,
        `getTokenAccountsByOwner(${owner.toBase58()},${mint.toBase58()})`
      )

      // Sum using raw amount/decimals for accuracy
      let totalAmount = 0n
      let decimals = 0
      for (const it of resp.value) {
        const info = (it.account.data as any).parsed?.info?.tokenAmount
        if (!info) continue
        const amtStr: string = info.amount
        const dec: number = info.decimals
        decimals = dec // same for all accounts of same mint
        try {
          totalAmount += BigInt(amtStr)
        } catch {
          this.logger.warn(`Non-integer token amount encountered for ${mint.toBase58()}`)
        }
      }

      // Convert bigint to number in UI units; large values may lose precision
      const ui = this.bigintToNumber(totalAmount, decimals)
      return ui
    }).finally(() => this.inflight.delete(key))

    this.inflight.set(key, task)
    const uiAmount = await task
    this.tokenCache.set(key, { ts: now, value: uiAmount })
    this.logger.info(`Fetched token ${mint.toBase58()} @ ${owner.toBase58()}: ${uiAmount}`)
    return uiAmount
  }

  /** Helper: retry an async function with linear backoff (no randomness) */
  private async callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown
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
      const id = setTimeout(() => reject(new Error(`Timeout after ${ms}ms in ${opName}`)), ms)
      promise.then(
        res => { clearTimeout(id); resolve(res) },
        err => { clearTimeout(id); reject(err) }
      )
    })
  }

  /** Helper: convert bigint amount with decimals to number */
  private bigintToNumber(amount: bigint, decimals: number): number {
    if (decimals <= 0) return Number(amount)
    const base = 10n ** BigInt(decimals)
    const whole = amount / base
    const frac = amount % base
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
    const s = fracStr.length ? `${whole}.${fracStr}` : whole.toString()
    return Number(s)
  }

  /** Helper: simple delay */
  private delay(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms))
  }

  /** Validate and build PublicKey with targeted error context */
  private toPublicKey(input: string, ctx: string): PublicKey {
    try {
      return new PublicKey(input)
    } catch (e) {
      this.logger.error(`Invalid PublicKey in ${ctx}: ${input}`)
      throw e
    }
  }

  /** Build a deterministic cache key including per-call options that affect result */
  private cacheKey(kind: 'sol' | 'token', owner: string, mint?: string, opts?: BalanceOptions): string {
    const c = (opts?.commitment ?? this.conn.commitment) || ''
    const t = String(opts?.timeoutMs ?? this.timeoutMs)
    return mint ? `${kind}:${owner}:${mint}:c=${c}:t=${t}` : `${kind}:${owner}:c=${c}:t=${t}`
  }
}
