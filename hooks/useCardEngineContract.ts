"use client"

import { useMemo } from "react"
import { getContract } from "viem"
import { usePublicClient, useWalletClient } from "wagmi"

import { cardEngineAbi } from "@/lib/abi/cardEngine"
import { getContracts } from "@/config/contracts"
import { activeChain } from "@/config/web3Shared"

export function useCardEngineContract(address?: `0x${string}`) {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const chainId = publicClient?.chain?.id ?? activeChain.id
  const contracts = useMemo(() => getContracts(chainId), [chainId])

  return useMemo(() => {
    if (!publicClient) return null
    return getContract({
      address: (address ?? contracts.cardEngine) as `0x${string}`,
      abi: cardEngineAbi,
      client: { public: publicClient, wallet: walletClient ?? undefined },
    })
  }, [address, contracts.cardEngine, publicClient, walletClient])
}
