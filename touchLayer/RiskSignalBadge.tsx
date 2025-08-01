// AnalyzerDashboard.tsx

import React, { useState, useEffect, useMemo } from 'react'
import AlertBanner from '@/components/AlertBanner'
import TokenInsightCard from '@/components/TokenInsightCard'
import RiskSignalBadge from '@/components/RiskSignalBadge'
import WalletActivityGraph from '@/components/WalletActivityGraph'
import WhaleTransferList from '@/components/WhaleTransferList'

interface TokenData {
  name: string
  riskLevel: 'Low' | 'Medium' | 'High'
  volume: number
}

interface WhaleTransfer {
  amount: number
  token: string
  address: string
}

interface ActivityPoint {
  time: string
  value: number
}

const fetchTokenData = async (): Promise<TokenData> => {
  // replace with real API call
  return new Promise(res =>
    setTimeout(() => res({
      name: 'SOLANA',
      riskLevel: 'High',
      volume: 1_543_200,
    }), 500)
  )
}

const fetchWhaleTransfers = async (): Promise<WhaleTransfer[]> => {
  // replace with real API call
  return new Promise(res =>
    setTimeout(() => res([
      { amount: 120_000, token: 'SOL', address: 'FgkE9rW...7Pq2' },
      { amount:  88_000, token: 'SOL', address: '9kq3reP...Mwb1' },
    ]), 500)
  )
}

const fetchWalletActivity = async (): Promise<ActivityPoint[]> => {
  // replace with real API call
  return new Promise(res =>
    setTimeout(() => res([
      { time: '10:00', value: 400 },
      { time: '11:00', value: 850 },
      { time: '12:00', value: 300 },
    ]), 500)
  )
}

const AnalyzerDashboard: React.FC = () => {
  const [tokenData, setTokenData] = useState<TokenData | null>(null)
  const [whaleTransfers, setWhaleTransfers] = useState<WhaleTransfer[]>([])
  const [walletActivity, setWalletActivity] = useState<ActivityPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchTokenData(), fetchWhaleTransfers(), fetchWalletActivity()])
      .then(([td, wt, wa]) => {
        setTokenData(td)
        setWhaleTransfers(wt)
        setWalletActivity(wa)
      })
      .catch(err => {
        console.error(err)
        setError('Failed to load data')
      })
      .finally(() => setLoading(false))
  }, [])

  const alertMessage = useMemo(() => {
    if (!tokenData) return ''
    return `🚨 Spike detected on ${tokenData.name} — ${(
      (tokenData.volume / 1000000) * 100
    ).toFixed(1)}% volume increase`
  }, [tokenData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-600">Loading dashboard…</span>
      </div>
    )
  }

  if (error || !tokenData) {
    return (
      <div className="p-6 bg-red-50 rounded">
        <p className="text-red-700">{error || 'Unknown error'}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 bg-gray-50">
      <AlertBanner message={alertMessage} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TokenInsightCard
          tokenName={tokenData.name}
          riskLevel={tokenData.riskLevel}
          volume={tokenData.volume}
        />
        <RiskSignalBadge level={tokenData.riskLevel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Wallet Activity</h2>
          <WalletActivityGraph data={walletActivity} />
        </section>
        <section className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Recent Whale Transfers</h2>
          <WhaleTransferList transfers={whaleTransfers} />
        </section>
      </div>
    </div>
  )
}

export default AnalyzerDashboard
