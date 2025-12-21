import { NextResponse } from "next/server"
import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"

import { cardEngineAbi } from "@/lib/abi/cardEngine"
import { env } from "@/lib/env"
import { getContracts } from "@/config/contracts"
import { activeChain } from "@/config/web3Shared"
import { RELAYER_ADDRESS } from "@/config/relayer"

const readPrivateKey = () => {
  const raw = process.env.RELAYER_PRIVATE_KEY
  if (!raw) return null
  const prefixed = raw.startsWith("0x") ? raw : `0x${raw}`
  if (prefixed.length !== 66) return null
  return prefixed as `0x${string}`
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const action = body.action as string | undefined
  const gameIdRaw = body.gameId as string | undefined

  if (action !== "join" && action !== "start") {
    return NextResponse.json({ error: "Unsupported relay action" }, { status: 400 })
  }
  if (!gameIdRaw) {
    return NextResponse.json({ error: "gameId is required" }, { status: 400 })
  }

  let gameId: bigint
  try {
    gameId = BigInt(gameIdRaw)
  } catch {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 })
  }

  const privateKey = readPrivateKey()
  if (!privateKey) {
    return NextResponse.json({ error: "RELAYER_PRIVATE_KEY not configured" }, { status: 400 })
  }

  const account = privateKeyToAccount(privateKey)
  if (RELAYER_ADDRESS && account.address.toLowerCase() !== RELAYER_ADDRESS.toLowerCase()) {
    return NextResponse.json(
      { error: "RELAYER_PRIVATE_KEY does not match the configured relayer address" },
      { status: 400 },
    )
  }

  const chainId = typeof body.chainId === "number" ? body.chainId : env.chainId
  const contracts = getContracts(chainId)
  if (!contracts.cardEngine) {
    return NextResponse.json({ error: "CardEngine address missing" }, { status: 400 })
  }

  const transport = http(env.rpcUrl)
  const walletClient = createWalletClient({
    chain: activeChain,
    transport,
    account,
  })
  const publicClient = createPublicClient({
    chain: activeChain,
    transport,
  })

  try {
    const hash = await walletClient.writeContract({
      address: contracts.cardEngine as `0x${string}`,
      abi: cardEngineAbi,
      functionName: action === "join" ? "joinGame" : "startGame",
      args: [gameId],
    })
    await publicClient.waitForTransactionReceipt({ hash })
    return NextResponse.json({ hash, relayer: account.address })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Relay transaction failed" },
      { status: 500 },
    )
  }
}
