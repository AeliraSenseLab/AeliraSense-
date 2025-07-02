
import fetch from 'node-fetch'

export interface TokenAccountInfo {
  address: string
  balance: number   // in base units
  owner: string
}

export async function scanTokenAccounts(
  mint: string,
  rpcUrl = 'https://api.mainnet-beta.solana.com',
  minBalance: number = 1
): Promise<TokenAccountInfo[]> {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getProgramAccounts',
    params: [
      '',
      {
        encoding: 'jsonParsed',
        filters: [
          { dataSize: 165 },
          { memcmp: { offset: 0, bytes: mint } }
        ]
      }
    ]
  }
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const json = await res.json() as any
  return json.result
    .map((acc: any) => ({
      address: acc.pubkey,
      balance: Number(acc.account.data.parsed.info.tokenAmount.amount),
      owner: acc.account.data.parsed.info.owner
    }))
    .filter((info: TokenAccountInfo) => info.balance >= minBalance)
}
