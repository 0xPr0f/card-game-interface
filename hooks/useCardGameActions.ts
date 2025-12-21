"use client"

import { useMemo } from "react"
import { useMutation } from "@tanstack/react-query"
import { parseEventLogs, type Hex } from "viem"
import { useAccount, usePublicClient, useWriteContract } from "wagmi"

import { cardEngineAbi } from "@/lib/abi/cardEngine"
import { whotManagerAbi } from "@/lib/abi/whotManager"
import { getContracts } from "@/config/contracts"
import { activeChain } from "@/config/web3Shared"

type CreateGameParams = {
  proposedPlayers?: readonly `0x${string}`[]
  ruleset?: `0x${string}`
  maxPlayers?: number
  initialHandSize?: number
  roulette?: boolean
}

type SimpleActionArgs = {
  gameId: bigint
}

type CommitArgs = SimpleActionArgs & { cardIndex: bigint }
type ExecuteArgs = SimpleActionArgs & {
  action: number
  proofData: Hex | `0x${string}`
  extraData?: Hex | `0x${string}`
}
type BootArgs = SimpleActionArgs & { playerIndex: bigint }

const DEFAULT_HAND = 5

export function useCardGameActions() {
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const { address } = useAccount()
  const chainId = publicClient?.chain?.id ?? activeChain.id
  const contracts = useMemo(() => getContracts(chainId), [chainId])

  const requireClient = () => {
    if (!publicClient) throw new Error("Public client not ready")
  }

  const createGame = useMutation({
    mutationKey: ["create-game"],
    mutationFn: async (params: CreateGameParams) => {
      requireClient()
      const hash = await writeContractAsync({
        abi: whotManagerAbi,
        address: contracts.whotManager as `0x${string}`,
        functionName: "createGame",
        args: [
          (params.ruleset ?? contracts.whotRuleset) as `0x${string}`,
          params.maxPlayers ?? 4,
          params.initialHandSize ?? DEFAULT_HAND,
          params.proposedPlayers ?? [],
          params.roulette ?? false,
        ],
      })
      const receipt = await publicClient!.waitForTransactionReceipt({ hash })
      const parsed = parseEventLogs({
        abi: cardEngineAbi,
        eventName: "GameCreated",
        logs: receipt.logs,
      })
      const gameId = parsed[0]?.args?.gameId as bigint | undefined
      return { hash, receipt, gameId }
    },
  })

  const joinGame = useMutation({
    mutationFn: async ({ gameId }: SimpleActionArgs) => {
      requireClient()
      const hash = await writeContractAsync({
        abi: cardEngineAbi,
        address: contracts.cardEngine as `0x${string}`,
        functionName: "joinGame",
        args: [gameId],
      })
      const receipt = await publicClient!.waitForTransactionReceipt({ hash })
      return { hash, receipt }
    },
  })

  const startGame = useMutation({
    mutationFn: async ({ gameId }: SimpleActionArgs) => {
      requireClient()
      const hash = await writeContractAsync({
        abi: cardEngineAbi,
        address: contracts.cardEngine as `0x${string}`,
        functionName: "startGame",
        args: [gameId],
      })
      const receipt = await publicClient!.waitForTransactionReceipt({ hash })
      return { hash, receipt }
    },
  })

  const commitMove = useMutation({
    mutationFn: async ({ gameId, cardIndex }: CommitArgs) => {
      requireClient()
      const hash = await writeContractAsync({
        abi: cardEngineAbi,
        address: contracts.cardEngine as `0x${string}`,
        functionName: "commitMove",
        args: [gameId, cardIndex],
      })
      const receipt = await publicClient!.waitForTransactionReceipt({ hash })
      return { hash, receipt }
    },
  })

  const breakCommitment = useMutation({
    mutationFn: async ({ gameId }: SimpleActionArgs) => {
      requireClient()
      const hash = await writeContractAsync({
        abi: cardEngineAbi,
        address: contracts.cardEngine as `0x${string}`,
        functionName: "breakCommitment",
        args: [gameId],
      })
      const receipt = await publicClient!.waitForTransactionReceipt({ hash })
      return { hash, receipt }
    },
  })

  const executeMove = useMutation({
    mutationFn: async ({ gameId, action, proofData, extraData }: ExecuteArgs) => {
      requireClient()
      const hash = await writeContractAsync({
        abi: cardEngineAbi,
        address: contracts.cardEngine as `0x${string}`,
        functionName: "executeMove",
        args: [gameId, BigInt(action), (proofData ?? "0x") as Hex, (extraData ?? "0x") as Hex],
      })
      const receipt = await publicClient!.waitForTransactionReceipt({ hash })
      return { hash, receipt }
    },
  })

  const forfeit = useMutation({
    mutationFn: async ({ gameId }: SimpleActionArgs) => {
      requireClient()
      const hash = await writeContractAsync({
        abi: cardEngineAbi,
        address: contracts.cardEngine as `0x${string}`,
        functionName: "forfeit",
        args: [gameId],
      })
      const receipt = await publicClient!.waitForTransactionReceipt({ hash })
      return { hash, receipt }
    },
  })

  const bootOut = useMutation({
    mutationFn: async ({ gameId, playerIndex }: BootArgs) => {
      requireClient()
      const hash = await writeContractAsync({
        abi: cardEngineAbi,
        address: contracts.cardEngine as `0x${string}`,
        functionName: "bootOut",
        args: [gameId, playerIndex],
      })
      const receipt = await publicClient!.waitForTransactionReceipt({ hash })
      return { hash, receipt }
    },
  })

  const isConnected = useMemo(() => Boolean(address), [address])

  return {
    createGame,
    joinGame,
    startGame,
    commitMove,
    breakCommitment,
    executeMove,
    forfeit,
    bootOut,
    isConnected,
  }
}
