import { Connection, PublicKey } from '@solana/web3.js'

/**
 * AeliraSense core agent for on-chain data access.
 */
export class AeliraCoreAgent {
  private conn: Connection

  constructor(rpcUrl: string, commitment: 'confirmed' | 'finalized' = 'confirmed') {
    this.conn = new Connection(rpcUrl, commitment)
  }

  /** Fetch SOL balance (in SOL) */
  public async getSolBalance(address: string): Promise<number> {
    const lamports = await this.conn.getBalance(new PublicKey(address))
    return lamports / 1e9
  }

  /** Fetch SPL token balance (in token units) */
  public async getTokenBalance(
    owner: string,
    mint: string
  ): Promise<number> {
    const resp = await this.conn.getTokenAccountsByOwner(
      new PublicKey(owner),
      { mint: new PublicKey(mint) },
      { encoding: 'jsonParsed' }
    )
    if (resp.value.length === 0) return 0
    const info = (resp.value[0].account.data.parsed.info.tokenAmount as any)
    return Number(info.uiAmount)
  }
}
