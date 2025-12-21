"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { padHex, toHex } from "viem"
import { getContracts } from "@/config/contracts"
import { activeChain } from "@/config/web3Shared"
import { WHOT_DECK } from "@/lib/cards"
import { env } from "@/lib/env"
import { usePublicClient, useAccount } from "wagmi"
import { fisherYatesShuffleU8 } from "@/lib/shuffle";
import { be32ToBigInt, splitIntoTwoUint256BE } from "@/lib/utils";
import { exportBurner } from "@/lib/burner";
import { createInstance, SepoliaConfig, initSDK } from "@zama-fhe/relayer-sdk/web"
// @ts-ignore – fhevm-ts-sdk ships ESM-only declarations
//import { useFhevmContext, type FHEDecryptRequest } from "fhevm-ts-sdk/react";

const EMPTY_HANDLE = padHex("0x", { size: 32 });

export type DeckJobStatus = "idle" | "queued" | "running" | "done" | "error";
export type DeckJobResult = {
  handles?: any[];
  inputProof?: any;
  raw?: unknown;
  source?: "local" | "remote";
};
const packLimb = (arr: number[]) =>
  arr.reduce((acc, v, i) => acc | (BigInt(v) << BigInt(i * 8)), BigInt(0))

export function useDeckJob() {
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<DeckJobStatus>("idle")
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<DeckJobResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const publicClient = usePublicClient()
  // const { status: fhevmStatus, error: fheError, instance, helpers } = useFhevmContext();
  const { address } = useAccount()
  const chainId = publicClient?.chain?.id ?? activeChain.id
  const contracts = useMemo(() => getContracts(chainId), [chainId])

  const shuffleLocalDeck = useCallback(() => {
    const deck = [...WHOT_DECK]
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }

    const limb0 = packLimb(deck.slice(0, 32))
    const limb1 = packLimb(deck.slice(32))
    const handles = [
      toHex(limb0, { size: 32 }) as `0x${string}`,
      toHex(limb1, { size: 32 }) as `0x${string}`,
    ]
    // Log for local dev visibility when TEE is disabled.
    console.log("Local deck shuffle", { handles, deck })
    return { handles, deck }
  }, [])

  const startJob = useCallback(

    async (opts?: { totalSize?: number; contractAddress?: string; importerAddress?: string }) => {
      const deck = Uint8Array.from(WHOT_DECK)
      setError(null)
      if (env.useTeeShuffle) {
        setProgress(0)
        setStatus("queued")
        const payload = {
          totalSize: opts?.totalSize ?? 24576,
          contractAddress: opts?.contractAddress ?? contracts.cardEngine,
          importerAddress: opts?.importerAddress ?? contracts.whotManager,
          chainId,
        }
        const resp = await fetch("/api/shuffle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!resp.ok) {
          const { error: msg } = await resp.json().catch(() => ({ error: resp.statusText }))
          setError(msg ?? "Failed to start shuffle")
          setStatus("error")
          return null
        }
        const data = await resp.json()
        const id = data.jobId as string | undefined
        if (!id) {
          setError("No jobId returned from shuffle service")
          setStatus("error")
          return null
        }
        setJobId(id)
        setStatus((data.status as DeckJobStatus) ?? "queued")
        return id
      } else {
        setStatus("running")
        // try {
        if (typeof window === "undefined") {
          throw new Error("Client encryption unavailable on server")
        }
        await initSDK();
        const instance = await createInstance(SepoliaConfig)

        // Use burner address as fallback if wagmi hook hasn't updated yet
        const userAddress = address ?? exportBurner()?.address

        console.log(contracts.cardEngine, userAddress);
        const input = instance.createEncryptedInput(contracts.cardEngine, userAddress as string)
        const shuffled = fisherYatesShuffleU8(deck);
        const [limb0, limb1] = splitIntoTwoUint256BE(shuffled);
        input.add256(be32ToBigInt(limb0));
        input.add256(be32ToBigInt(limb1));

        const { handles: rawHandles, inputProof: rawInputProof } = await input.encrypt()
        if (!rawHandles || rawHandles.length < 2) throw new Error("Encrypt returned no handles")

        // Convert handles to hex strings if they're not already
        const handles = Array.isArray(rawHandles)
          ? rawHandles.map((h) => (typeof h === "string" ? h : toHex(h, { size: 32 })))
          : rawHandles

        // Ensure inputProof is a hex string
        const inputProof = typeof rawInputProof === "string" ? rawInputProof : toHex(rawInputProof)

        console.log({
          handles,
          inputProof,
          raw: { handles, inputProof },
          source: "remote",
        });

        setResult({
          handles,
          inputProof,
          raw: { handles, inputProof },
          source: "remote",
        })
        setProgress(100)
        setStatus("done")
        setJobId("encrypt")
        return "encrypt"
        /* } catch (err) {
           console.log(err)
           /*  const { handles, deck } = shuffleLocalDeck()
             setResult({
               handles,
               inputProof: "0x",
               raw: { deck, fallbackError: err instanceof Error ? err.message : String(err) },
               source: "local",
             })
             setProgress(100)
             setStatus("done")
             setJobId("local")
             return "local"
         }*/
      }
    },
    [chainId, contracts.cardEngine, contracts.whotManager, shuffleLocalDeck],
  )

  useEffect(() => {
    if (!env.useTeeShuffle || !jobId || jobId === "local") return
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`/api/shuffle/status?id=${jobId}`)
        const json = await resp.json()
        setStatus((json.status as DeckJobStatus) ?? "running")
        setProgress(Number(json.progress ?? 0))
        if (json.status === "done") {
          setResult({
            handles: json.handles,
            inputProof: json.inputProof ?? json.result?.[0],
            raw: json,
          })
          clearInterval(interval)
        } else if (json.status === "error") {
          setError(json.error ?? "Shuffle job failed")
          clearInterval(interval)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Shuffle status failed")
        setStatus("error")
        clearInterval(interval)
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [jobId, chainId])

  const inputData = useMemo(() => {
    const handles = result?.handles
    if (!handles || handles.length < 2) return undefined
    return {
      inputZero: (handles[0] ?? EMPTY_HANDLE) as `0x${string}`,
      inputOneType: 2, // InputOneType.EINPUT256
      inputOne64: EMPTY_HANDLE as `0x${string}`,
      inputOne128: EMPTY_HANDLE as `0x${string}`,
      inputOne256: (handles[1] ?? EMPTY_HANDLE) as `0x${string}`,
    }
  }, [result])

  const inputProof = useMemo(
    () => (result?.inputProof ?? "0x") as `0x${string}`,
    [result?.inputProof],
  )

  const reset = useCallback(() => {
    setJobId(null)
    setStatus("idle")
    setProgress(0)
    setResult(null)
    setError(null)
  }, [])

  useEffect(() => {
    reset()
  }, [chainId, reset])

  return {
    jobId,
    status,
    progress,
    result,
    inputData,
    inputProof,
    error,
    startJob,
    reset,
  }
}
