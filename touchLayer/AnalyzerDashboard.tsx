// AnalyzerDashboard.tsx

import React from 'react'
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

const AnalyzerDashboard: React.FC = () => {
  const tokenData: TokenData = {
    name: 'SOLANA',
    riskLevel: 'High',
    volume: 1_543_200,
  }

  const whaleTransfers: WhaleTransfer[] = [
    { amount: 120_000, token: 'SOL', address: 'FgkE9rW...7Pq2' },
    { amount:  88_000, token: 'SOL', address: '9kq3reP...Mwb1' },
  ]

  const walletActivity: ActivityPoint[] = [
    { time: '10:00', value: 400 },
    { time: '11:00', value: 850 },
    { time: '12:00', value: 300 },
  ]

  return (
    <div className="p-6 space-y-8 bg-gray-50">
      <AlertBanner 
        message="🚨 Spike detected on SOL — 37.4% risk increase in last hour" 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TokenInsightCard
          tokenName={tokenData.name}
          riskLevel={tokenData.riskLevel}
          volume={tokenData.volume}
        />
        <RiskSignalBadge level={tokenData.riskLevel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Wallet Activity</h2>
          <WalletActivityGraph data={walletActivity} />
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Recent Whale Transfers</h2>
          <WhaleTransferList transfers={whaleTransfers} />
        </div>
      </div>
    </div>
  )
}

export default AnalyzerDashboard
