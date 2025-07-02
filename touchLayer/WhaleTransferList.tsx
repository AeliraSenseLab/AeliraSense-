import React from 'react'

interface WhaleTransfer {
  amount: number
  token: string
  address: string
}

interface WhaleTransferListProps {
  transfers: WhaleTransfer[]
}

const WhaleTransferList: React.FC<WhaleTransferListProps> = ({ transfers }) => (
  <ul className="space-y-2">
    {transfers.map((tx, i) => (
      <li
        key={i}
        className="flex justify-between items-center bg-white p-3 rounded-lg shadow"
      >
        <span className="font-mono">{tx.address}</span>
        <span>
          {tx.amount.toLocaleString()} {tx.token}
        </span>
      </li>
    ))}
  </ul>
)

export default WhaleTransferList
