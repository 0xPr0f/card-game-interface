"use client"

import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { Address, GetLogsParameters, Log } from "viem"
import { usePublicClient } from "wagmi"
import { useEffect } from "react"

import { getContracts } from "@/config/contracts"
import { activeChain } from "@/config/web3Shared"
import { getLogsBalanced } from "@/lib/rpcPool"

type UseEventsArgs<TLog> = {
  queryKey: unknown[]
  address?: Address
  event: GetLogsParameters["event"]
  fromBlock?: GetLogsParameters["fromBlock"]
  toBlock?: GetLogsParameters["toBlock"]
  enabled?: boolean
  select?: (logs: Log[]) => TLog[]
}

export function useEvents<TLog = Log>({
  queryKey,
  address,
  event,
  fromBlock,
  toBlock,
  enabled = true,
  select,
}: UseEventsArgs<TLog>) {
  const publicClient = usePublicClient()
  const queryClient = useQueryClient()
  const chainId = publicClient?.chain?.id ?? activeChain.id
  const contracts = useMemo(() => getContracts(chainId), [chainId])
  const computedFromBlock = useMemo(
    () => (typeof fromBlock !== "undefined" ? fromBlock : contracts.deployFromBlock ? BigInt(contracts.deployFromBlock) : undefined),
    [contracts.deployFromBlock, fromBlock],
  )
  const key = useMemo(() => ["events", chainId, ...queryKey], [chainId, queryKey])

  useEffect(() => {
    if (!publicClient || !enabled || !event) return
    const unwatch = publicClient.watchContractEvent({
      address,
      event,
      fromBlock: computedFromBlock,
      onError: () => queryClient.invalidateQueries({ queryKey: key }),
      onLogs: () => queryClient.invalidateQueries({ queryKey: key }),
    })
    return () => {
      try {
        unwatch?.()
      } catch {
        // no-op
      }
    }
  }, [address, computedFromBlock, enabled, event, key, publicClient, queryClient])

  return useQuery({
    queryKey: key,
    enabled: Boolean(publicClient && enabled && event),
    queryFn: async () => {
      if (!publicClient || !event) return []
      const logs = await getLogsBalanced({ address, event, fromBlock: computedFromBlock, toBlock })
      return select ? select(logs as Log[]) : (logs as TLog[])
    },
    refetchInterval: 12_000,
  })
}
