
export function sanitizeTransferPayload(raw: any): {
  recipient: string
  amount: number
  tokenMint: string
} {
  // Trim strings, parse numbers, enforce lowercase addresses
  const recipient = (raw.recipient || "").trim()
  const amount = Number(raw.amount)
  const tokenMint = (raw.tokenMint || "").trim()

  return { recipient, amount, tokenMint }
}
