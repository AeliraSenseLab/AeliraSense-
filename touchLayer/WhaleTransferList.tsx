import React from "react"

interface WhaleTransfer {
  amount: number
  token: string
  address: string
}

interface WhaleTransferListProps {
  transfers: WhaleTransfer[]
}

const formatAddress = (addr: string) =>
  addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : addr

const WhaleTransferList: React.FC<WhaleTransferListProps> = ({ transfers }) => {
  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr).catch(() => {
      console.error("Failed to copy address")
    })
  }

  return (
    <ul className="space-y-3">
      {transfers.map((tx, i) => (
        <li
          key={i}
          className="flex justify-between items-center bg-white p-4 rounded-xl shadow hover:shadow-md transition"
        >
          <button
            onClick={() => handleCopy(tx.address)}
            className="font-mono text-sm text-gray-700 hover:text-indigo-600"
            title="Click to copy address"
          >
            {formatAddress(tx.address)}
          </button>
          <span
            className={`font-semibold ${
              tx.amount > 10000 ? "text-green-600" : "text-gray-800"
            }`}
          >
            {tx.amount.toLocaleString()} {tx.token}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default WhaleTransferList
