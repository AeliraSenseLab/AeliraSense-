import React from 'react'

interface RiskSignalBadgeProps {
  level: 'Low' | 'Medium' | 'High'
}

const badgeStyles = {
  Low: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  High: 'bg-red-100 text-red-800'
} as const

const RiskSignalBadge: React.FC<RiskSignalBadgeProps> = ({ level }) => (
  <span
    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${badgeStyles[level]}`}
  >
    {level} Risk
  </span>
)

export default RiskSignalBadge
