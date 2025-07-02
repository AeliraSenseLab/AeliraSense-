

import fetch from 'node-fetch'
import { Connection, PublicKey } from '@solana/web3.js'
import { AeliraCoreAgent } from './aeliraCoreAgent'
import { AeliraMetricsCache } from './aeliraMetricsCache'

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


export class AeliraScanner {
  private connection: Connection
  private coreAgent: AeliraCoreAgent
  private metricsCache: AeliraMetricsCache
  private TOKEN_PROGRAM = new PublicKey(
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
  )

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed')
    this.coreAgent = new AeliraCoreAgent(rpcUrl)
    this.metricsCache = new AeliraMetricsCache(rpcUrl)
  }

  public async scanNewTokenAccounts(
    mint: string,
    minBalance: number = 1
  ): Promise<TokenAccount[]> {
    const resp = await this.connection.getProgramAccounts(this.TOKEN_PROGRAM, {
      encoding: 'jsonParsed',
      filters: [
        { dataSize: 165 },
        { memcmp: { offset: 0, bytes: mint } }
      ]
    })
    return resp
      .map(acc => {
        const info = (acc.account.data as any).parsed.info
        return {
          address: acc.pubkey,
          owner: info.owner,
          balance: Number(info.tokenAmount.amount)
        }
      })
      .filter(a => a.balance >= minBalance)
  }

  public async fetchRecentTransfers(
    mint: string,
    limit: number = 100
  ): Promise<TransferEvent[]> {
    const url = `https://public-api.solscan.io/account/token/txs?account=${mint}&limit=${limit}`
    const res = await fetch(url)
    const data = (await res.json()).data as any[]
    return data
      .filter(tx => tx.err === null)
      .map(tx => ({
        signature: tx.signature,
        slot: tx.slot,
        amount: Number(tx.tokenAmount.amount),
        from: tx.userAddress,
        to: tx.destination,
        timestamp: (tx.blockTime || 0) * 1000
      }))
  }

  public async traceTokenDistribution(
    mint: string,
    topN: number = 20
  ): Promise<DistributionSnapshot[]> {
    const url = `https://public-api.solscan.io/token/holders?tokenAddress=${mint}&limit=${topN}`
    const res = await fetch(url)
    const data = (await res.json()) as any[]
    return data.map(h => ({
      address: h.ownerAddress,
      amount: Number(h.tokenAmount)
    }))
  }
