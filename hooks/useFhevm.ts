"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  createInstance,
  initSDK,
  SepoliaConfig,
  type ClearValues,
  type EIP712,
  type FhevmInstance,
  type HandleContractPair,
} from "@zama-fhe/relayer-sdk/web"

import { env } from "@/lib/env"
import { activeChain } from "@/config/web3Shared"

export type FhevmStatus = "idle" | "loading" | "ready" | "error"
export type UserDecryptParams = {
  handles: HandleContractPair[]
  privateKey: string
  publicKey: string
  signature: string
  contractAddresses: string[]
  userAddress: string
  startTimestamp: number
  durationDays: number
}

const resolveRpcUrl = () => {
  if (env.rpcUrls.length) return env.rpcUrls[0]
  if (env.rpcUrl) return env.rpcUrl
  return SepoliaConfig.network
}

const resolveNetwork = async (rpcUrl: string) => {
  if (typeof window === "undefined") return rpcUrl
  const provider = (window as { ethereum?: { request?: (args: { method: string }) => Promise<string> } })
    .ethereum
  if (!provider?.request) return rpcUrl
  try {
    const chainIdHex = await provider.request({ method: "eth_chainId" })
    const chainId = typeof chainIdHex === "string" ? Number.parseInt(chainIdHex, 16) : Number(chainIdHex)
    if (Number.isFinite(chainId) && chainId === activeChain.id) {
      return provider
    }
  } catch {
    // ignore provider chain detection failures
  }
  return rpcUrl
}

const buildConfig = (network: unknown) => {
  const base = SepoliaConfig
  const relayerUrl = env.relayerUrl || base.relayerUrl
  return {
    ...base,
    chainId: activeChain.id,
    relayerUrl,
    network,
  }
}

export function useFhevm() {
  const [status, setStatus] = useState<FhevmStatus>("idle")
  const [error, setError] = useState<Error | null>(null)
  const instanceRef = useRef<FhevmInstance | null>(null)

  useEffect(() => {
    let mounted = true
    const init = async () => {
      if (typeof window === "undefined") return
      if (instanceRef.current) {
        setStatus("ready")
        return
      }
      setStatus("loading")
      try {
        await initSDK()
        const rpcUrl = resolveRpcUrl()
        const network = await resolveNetwork(rpcUrl)
        let instance: FhevmInstance | null = null
        try {
          instance = await createInstance(buildConfig(network))
        } catch (err) {
          if (network !== rpcUrl) {
            instance = await createInstance(buildConfig(rpcUrl))
          } else {
            throw err
          }
        }
        if (!mounted) return
        instanceRef.current = instance
        setStatus("ready")
      } catch (err) {
        if (!mounted) return
        const resolved = err instanceof Error ? err : new Error("FHE init failed")
        setError(resolved)
        setStatus("error")
      }
    }
    void init()
    return () => {
      mounted = false
    }
  }, [])

  const publicDecrypt = useCallback(
    async (handles: (string | Uint8Array)[]) => {
      if (!instanceRef.current) {
        throw new Error("FHE instance not ready")
      }
      return instanceRef.current.publicDecrypt(handles)
    },
    [],
  )

  const userDecrypt = useCallback(
    async ({
      handles,
      privateKey,
      publicKey,
      signature,
      contractAddresses,
      userAddress,
      startTimestamp,
      durationDays,
    }: UserDecryptParams): Promise<ClearValues> => {
      if (!instanceRef.current) {
        throw new Error("FHE instance not ready")
      }
      return instanceRef.current.userDecrypt(
        handles,
        privateKey,
        publicKey,
        signature,
        contractAddresses,
        userAddress,
        startTimestamp,
        durationDays,
      )
    },
    [],
  )

  const createEip712 = useCallback(
    (
      publicKey: string,
      contractAddresses: string[],
      startTimestamp: number,
      durationDays: number,
    ): EIP712 => {
      if (!instanceRef.current) {
        throw new Error("FHE instance not ready")
      }
      return instanceRef.current.createEIP712(
        publicKey,
        contractAddresses,
        startTimestamp,
        durationDays,
      )
    },
    [],
  )

  const generateKeypair = useCallback(() => {
    if (!instanceRef.current) {
      throw new Error("FHE instance not ready")
    }
    return instanceRef.current.generateKeypair()
  }, [])

  return useMemo(
    () => ({
      publicDecrypt,
      userDecrypt,
      createEip712,
      generateKeypair,
      status,
      error,
    }),
    [publicDecrypt, userDecrypt, createEip712, generateKeypair, status, error],
  )
}
