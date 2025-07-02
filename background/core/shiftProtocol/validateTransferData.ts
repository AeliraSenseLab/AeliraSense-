
export function validateTransferData(data: {
  recipient: string
  amount: number
  tokenMint: string
}): void {
  const solanaAddressRegex = /^[A-Za-z0-9]{32,44}$/
  if (!solanaAddressRegex.test(data.recipient)) {
    throw new Error(`Invalid recipient address: ${data.recipient}`)
  }
  if (!(data.amount > 0)) {
    throw new Error(`Amount must be a positive number, got: ${data.amount}`)
  }
  if (!solanaAddressRegex.test(data.tokenMint) && data.tokenMint !== "SOL") {
    throw new Error(`Invalid token mint: ${data.tokenMint}`)
  }
}