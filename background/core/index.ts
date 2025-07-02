
import { AnalysisCore, AnalysisResult } from './analysisCore'
import { SigningEngine } from './signingEngine'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'

async function main() {
  const rpcUrl = 'https://api.mainnet-beta.solana.com'
  const mintAddress = {token}
  const analysisCore = new AnalysisCore(rpcUrl)

  // 1. Run analysis
  const result: AnalysisResult = await analysisCore.analyze(mintAddress)
  console.log('Analysis:', result)

  // 2. Sign & prepare on-chain memo
  const connection = new Connection(rpcUrl, 'confirmed')
  const signer = Keypair.fromSecretKey(/* your secret key array */ new Uint8Array([]))
  const programId = new PublicKey()
  const engine = new SigningEngine(programId, signer)

  const signed = await engine.signAnalysis(result)
  console.log('Signed transaction (base64):', signed)

  // 3. Optionally send:
  // const sig = await connection.sendRawTransaction(Buffer.from(signed, 'base64'))
  // console.log('On-chain signature:', sig)
}

main().catch(console.error)
