"use client"

import { useMemo } from "react"
import { getContract } from "viem"
import { usePublicClient } from "wagmi"

import { whotRulesetAbi } from "@/lib/abi/whotRuleset"
import { getContracts } from "@/config/contracts"
import { activeChain } from "@/config/web3Shared"

export function useWhotRuleset(address?: `0x${string}`) {
  const publicClient = usePublicClient()
  const chainId = publicClient?.chain?.id ?? activeChain.id
  const contracts = useMemo(() => getContracts(chainId), [chainId])
  return useMemo(() => {
    if (!publicClient) return null
    return getContract({
      address: (address ?? contracts.whotRuleset) as `0x${string}`,
      abi: whotRulesetAbi,
      client: { public: publicClient },
    })
  }, [address, contracts.whotRuleset, publicClient])
}
