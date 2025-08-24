import fetch, { RequestInit } from 'node-fetch'

export interface PairInfo {
  dex: string
  baseMint: string
  quoteMint: string
  marketAddress?: string
  poolAddress?: string
}

interface DexEndpoint {
  name: string
  url: string
  parser: (data: any) => PairInfo[]
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<any> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { signal: controller.signal, ...options })
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} at ${url}`)
    }
    return response.json()
  } finally {
    clearTimeout(id)
  }
}

const dexEndpoints: DexEndpoint[] = [
  {
    name: 'Serum',
    url: 'https://api.serum-v2.mainnet.rpcpool.com/markets',
    parser: (markets: any[]) =>
      markets.map(m => ({
        dex: 'Serum',
        baseMint: m.baseMint,
        quoteMint: m.quoteMint,
        marketAddress: m.address,
      })),
  },
  {
    name: 'Raydium',
    url: 'https://api.raydium.io/v2/main/pairs',
    parser: (pairs: any[]) =>
      pairs.map(p => ({
        dex: 'Raydium',
        baseMint: p.baseMint,
        quoteMint: p.quoteMint,
        poolAddress: p.ammId,
      })),
  },
]


export async function fetchDexTokenPairs(): Promise<PairInfo[]> {
  const results: PairInfo[] = []
  await Promise.all(
    dexEndpoints.map(async ({ name, url, parser }) => {
      try {
        const data = await fetchWithTimeout(url)
        results.push(...parser(data))
      } catch (err) {
        console.warn(`${name} fetch failed:`, err)
      }
    })
  )
  return results
}
