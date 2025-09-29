// analyzer_dashboard.tsx

import React from "react"
import AlertBanner from "@/components/AlertBanner"
import TokenInsightCard from "@/components/TokenInsightCard"
import RiskSignalBadge from "@/components/RiskSignalBadge"
import WalletActivityGraph from "@/components/WalletActivityGraph"
import WhaleTransferList from "@/components/WhaleTransferList"

interface TokenData {
  name: string
  riskLevel: "Low" | "Medium" | "High"
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

const formatNumber = (n: number): string => {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K"
  return n.toString()
}

const AnalyzerDashboard: React.FC = () => {
  const tokenData: TokenData = {
    name: "SOLANA",
    riskLevel: "High",
    volume: 1_543_200,
  }

  const whaleTransfers: WhaleTransfer[] = [
    { amount: 120_000, token: "SOL", address: "FgkE9rW...7Pq2" },
    { amount: 88_000, token: "SOL", address: "9kq3reP...Mwb1" },
  ]

  const walletActivity: ActivityPoint[] = [
    { time: "10:00", value: 400 },
    { time: "11:00", value: 850 },
    { time: "12:00", value: 300 },
  ]

  return (
    <main className="p-6 space-y-8 bg-gray-50 min-h-screen">
      <header>
        <AlertBanner message="🚨 Spike detected on SOL — 37.4% risk increase in last hour" />
      </header>

      <section
        aria-labelledby="token-overview"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <h2 id="token-overview" className="sr-only">
          Token Overview
        </h2>
        <TokenInsightCard
          tokenName={tokenData.name}
          riskLevel={tokenData.riskLevel}
          volume={tokenData.volume}
        />
        <RiskSignalBadge level={tokenData.riskLevel} />
      </section>

      <section
        aria-labelledby="activity-section"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <h2 id="activity-section" className="sr-only">
          Activity and Transfers
        </h2>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Wallet Activity</h3>
          <WalletActivityGraph data={walletActivity} />
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">
            Recent Whale Transfers
          </h3>
          <WhaleTransferList
            transfers={whaleTransfers.map((t) => ({
              ...t,
              amountFormatted: formatNumber(t.amount),
            }))}
          />
        </div>
      </section>
    </main>
  )
}

export default AnalyzerDashboard
