import fetch from "node-fetch"
import { Connection, PublicKey } from "@solana/web3.js"
import { z } from "zod"
import { AeliraCoreAgent } from "./aeliraCoreAgent"
import { AeliraMetricsCache } from "./aeliraMetricsCache"

export interface TokenAccount {
  address: string
  owner: string
  balance: number
}

export interface TransferEvent {
  signature: string
  slot: number
  amount: number
  from: string
  to: string
  timestamp: number
}

export interface DistributionSnapshot {
  address: string
  amount: number
}

const RETRIES = 3
const BACKOFF_MS = 1000

const SolscanTransferSchema = z.object({
  signature: z.string(),
  slot: z.number(),
  err: z.null(),
  blockTime: z.number().nullable().optional(),
  userAddress: z.string(),
  destination: z.string(),
  tokenAmount: z.object({
    amount: z.string().or(z.number()),
    decimals: z.number().optional(),
    uiAmount: z.number().nullable().optional(),
    uiAmountString: z.string().optional()
  })
})

const SolscanTransfersEnvelope = z.object({
  data: z.array(SolscanTransferSchema)
})

const SolscanHolderSchema = z.object({
  ownerAddress: z.string(),
  tokenAmount: z.union([
    z.number(),
    z.string(),
    z.object({
      amount: z.string().or(z.number()).optional(),
      decimals: z.number().optional(),
      uiAmount: z.number().nullable().optional(),
      uiAmountString: z.string().optional()
    })
  ])
})

const SolscanHoldersEnvelope = z.object({
  data: z.array(SolscanHolderSchema).optional()
}).or(z.array(SolscanHolderSchema))

function normalizeUiAmount(input: any): number {
  if (input == null) return 0
  if (typeof input === "number") return input
  if (typeof input === "string") {
    const n = Number(input)
    return Number.isFinite(n) ? n : 0
  }
  if (typeof input === "object") {
    if (typeof input.uiAmount === "number" && input.uiAmount !== null) return input.uiAmount
    if (typeof input.uiAmountString === "string") {
      const n = Number(input.uiAmountString)
      if (Number.isFinite(n)) return n
    }
    const amt = typeof input.amount === "string" ? Number(input.amount) : input.amount
    const dec = typeof input.decimals === "number" ? input.decimals : undefined
    if (Number.isFinite(amt) && typeof dec === "number") return amt / Math.pow(10, dec)
    if (Number.isFinite(amt)) return Number(amt)
  }
  return 0
}

async function httpGetJson<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
  let lastErr: any = null
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "aelira-scanner/1.0",
        ...(headers || {})
      }
    })
    if (res.ok) {
      return (await res.json()) as T
    }
    lastErr = new Error(`HTTP ${res.status} ${res.statusText}`)
    if (res.status === 429 || res.status >= 500) {
      await new Promise(r => setTimeout(r, BACKOFF_MS * (attempt + 1)))
      continue
    } else {
      break
    }
  }
  throw lastErr
}

export class AeliraScanner {
  private connection: Connection
  private coreAgent: AeliraCoreAgent
  private metricsCache: AeliraMetricsCache
  private TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, "confirmed")
    this.coreAgent = new AeliraCoreAgent(rpcUrl)
    this.metricsCache = new AeliraMetricsCache(rpcUrl)
  }

  public async scanNewTokenAccounts(mint: string, minBalance: number = 1): Promise<TokenAccount[]> {
    const resp = await this.connection.getProgramAccounts(this.TOKEN_PROGRAM, {
      encoding: "jsonParsed",
      filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: mint } }]
    })
    return resp
      .map(acc => {
        const parsed: any = (acc.account.data as any).parsed
        const info = parsed?.info
        const tokenAmount = info?.tokenAmount
        const balance = normalizeUiAmount(tokenAmount)
        return {
          address: acc.pubkey.toBase58(),
          owner: String(info?.owner ?? ""),
          balance
        }
      })
      .filter(a => a.owner && a.balance >= minBalance)
  }

  public async fetchRecentTransfers(mint: string, limit: number = 100): Promise<TransferEvent[]> {
    const url = `https://public-api.solscan.io/account/token/txs?account=${mint}&limit=${limit}`
    const raw = await httpGetJson<any>(url)
    const parsed = SolscanTransfersEnvelope.safeParse(raw)
    const list = parsed.success ? parsed.data.data : Array.isArray(raw?.data) ? raw.data : []
    return list
      .filter((tx: any) => tx && tx.err === null)
      .map((tx: any) => {
        const amt = normalizeUiAmount(tx.tokenAmount)
        return {
          signature: String(tx.signature),
          slot: Number(tx.slot),
          amount: amt,
          from: String(tx.userAddress ?? ""),
          to: String(tx.destination ?? ""),
          timestamp: Number(tx.blockTime ? tx.blockTime * 1000 : 0)
        }
      })
      .filter(e => e.signature && (e.from || e.to))
  }

  public async traceTokenDistribution(mint: string, topN: number = 20): Promise[DistributionSnapshot[]> {
    const url = `https://public-api.solscan.io/token/holders?tokenAddress=${mint}&limit=${topN}`
    const raw = await httpGetJson<any>(url)
    const parsed = SolscanHoldersEnvelope.safeParse(raw)
    const rows = parsed.success
      ? Array.isArray(parsed.data) ? parsed.data : parsed.data.data ?? []
      : Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []
    return rows.map((h: any) => ({
      address: String(h.ownerAddress ?? ""),
      amount: normalizeUiAmount(h.tokenAmount)
    })).filter(r => r.address)
  }
}
